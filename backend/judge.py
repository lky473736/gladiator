import httpx
import time
import logging
from models import SubmissionStatus

logger = logging.getLogger(__name__)

# Piston API (무료 코드 실행 API)
PISTON_API_URL = "https://emkc.org/api/v2/piston/execute"

class CodeExecutor:
    def __init__(self, time_limit_ms: int, memory_limit_mb: int):
        self.time_limit_ms = time_limit_ms
        self.memory_limit_mb = memory_limit_mb
        self.time_limit_sec = time_limit_ms / 1000.0

    def execute_code(self, code: str, input_data: str) -> dict:
        """
        Piston API를 사용하여 C++ 코드를 실행합니다.
        Returns: {'success': bool, 'output': str, 'error': str, 'execution_time': int}
        """
        try:
            start_time = time.time()

            payload = {
                "language": "c++",
                "version": "10.2.0",
                "files": [
                    {
                        "name": "main.cpp",
                        "content": code
                    }
                ],
                "stdin": input_data,
                "compile_timeout": 10000,
                "run_timeout": self.time_limit_ms,
                "compile_memory_limit": -1,
                "run_memory_limit": self.memory_limit_mb * 1024 * 1024
            }

            with httpx.Client(timeout=30.0) as client:
                response = client.post(PISTON_API_URL, json=payload)

            execution_time_ms = int((time.time() - start_time) * 1000)

            if response.status_code != 200:
                return {
                    'success': False,
                    'output': '',
                    'error': f"API 오류: {response.status_code}",
                    'execution_time': execution_time_ms
                }

            result = response.json()

            # 컴파일 에러 체크
            if result.get('compile') and result['compile'].get('stderr'):
                return {
                    'success': False,
                    'output': '',
                    'error': result['compile']['stderr'],
                    'execution_time': execution_time_ms,
                    'is_compile_error': True
                }

            # 런타임 결과
            run_result = result.get('run', {})
            stdout = run_result.get('stdout', '')
            stderr = run_result.get('stderr', '')
            exit_code = run_result.get('code', 0)

            # 타임아웃 체크
            if run_result.get('signal') == 'SIGKILL':
                return {
                    'success': False,
                    'output': '',
                    'error': 'Time Limit Exceeded',
                    'execution_time': self.time_limit_ms,
                    'is_tle': True
                }

            # 런타임 에러 체크
            if exit_code != 0 or stderr:
                return {
                    'success': False,
                    'output': stdout,
                    'error': stderr or f"Exit code: {exit_code}",
                    'execution_time': execution_time_ms,
                    'is_runtime_error': True
                }

            return {
                'success': True,
                'output': stdout,
                'error': '',
                'execution_time': execution_time_ms
            }

        except httpx.TimeoutException:
            return {
                'success': False,
                'output': '',
                'error': 'API 요청 타임아웃',
                'execution_time': self.time_limit_ms
            }
        except Exception as e:
            logger.error(f"코드 실행 중 오류: {e}")
            return {
                'success': False,
                'output': '',
                'error': str(e),
                'execution_time': 0
            }

    def compare_output(self, expected: str, actual: str, strict: bool = False) -> bool:
        """
        출력을 비교합니다.
        strict=False: 공백 차이 무시
        strict=True: 정확히 일치해야 함
        """
        if strict:
            return expected == actual

        # 공백 정규화
        expected_lines = [line.strip() for line in expected.strip().split('\n')]
        actual_lines = [line.strip() for line in actual.strip().split('\n')]

        return expected_lines == actual_lines

    def judge(self, code: str, test_cases: list) -> dict:
        """
        코드를 채점합니다.
        """
        result = {
            'status': SubmissionStatus.PREPARING.value,
            'passed': 0,
            'total': len(test_cases),
            'execution_time': 0,
            'memory_used': 0,
            'error_message': None,
            'failed_test_case': None,
            'test_results': []
        }

        result['status'] = SubmissionStatus.JUDGING.value
        max_time = 0

        for i, test_case in enumerate(test_cases):
            progress = ((i + 1) / len(test_cases)) * 100
            logger.info(f"🔄 테스트케이스 검증 중: {i + 1}/{len(test_cases)} ({progress:.1f}%)")

            # 코드 실행
            exec_result = self.execute_code(code, test_case['input_data'])
            exec_time = exec_result['execution_time']
            max_time = max(max_time, exec_time)

            test_result = {
                'test_case_id': test_case.get('id', i),
                'status': SubmissionStatus.JUDGING.value,
                'execution_time': exec_time,
                'passed': False
            }

            # 컴파일 에러
            if exec_result.get('is_compile_error'):
                result['status'] = SubmissionStatus.COMPILE_ERROR.value
                result['error_message'] = exec_result['error']
                result['execution_time'] = max_time
                test_result['status'] = SubmissionStatus.COMPILE_ERROR.value
                result['test_results'].append(test_result)
                logger.error(f"❌ 컴파일 에러: {exec_result['error'][:200]}")
                return result

            # 타임아웃
            if exec_result.get('is_tle'):
                result['status'] = SubmissionStatus.TIME_LIMIT_EXCEEDED.value
                result['execution_time'] = max_time
                result['failed_test_case'] = {
                    'id': test_case.get('id', i),
                    'input': test_case['input_data'],
                    'expected': test_case['output_data'],
                    'actual': ''
                }
                test_result['status'] = SubmissionStatus.TIME_LIMIT_EXCEEDED.value
                result['test_results'].append(test_result)
                logger.error(f"❌ 테스트케이스 {i + 1} 실패: 시간 초과")
                return result

            # 런타임 에러
            if exec_result.get('is_runtime_error') or not exec_result['success']:
                result['status'] = SubmissionStatus.RUNTIME_ERROR.value
                result['error_message'] = exec_result['error']
                result['execution_time'] = max_time
                result['failed_test_case'] = {
                    'id': test_case.get('id', i),
                    'input': test_case['input_data'],
                    'expected': test_case['output_data'],
                    'actual': exec_result['error']
                }
                test_result['status'] = SubmissionStatus.RUNTIME_ERROR.value
                result['test_results'].append(test_result)
                logger.error(f"❌ 테스트케이스 {i + 1} 실패: 런타임 에러 - {exec_result['error'][:100]}")
                return result

            # 출력 비교
            actual_output = exec_result['output']
            if self.compare_output(test_case['output_data'], actual_output):
                result['passed'] += 1
                test_result['passed'] = True
                test_result['status'] = SubmissionStatus.ACCEPTED.value
                logger.info(f"✅ 테스트케이스 {i + 1} 통과")
            else:
                expected_lines = len(test_case['output_data'].strip().split('\n'))
                actual_lines = len(actual_output.strip().split('\n'))

                if expected_lines != actual_lines:
                    result['status'] = SubmissionStatus.PRESENTATION_ERROR.value
                    test_result['status'] = SubmissionStatus.PRESENTATION_ERROR.value
                else:
                    result['status'] = SubmissionStatus.WRONG_ANSWER.value
                    test_result['status'] = SubmissionStatus.WRONG_ANSWER.value

                result['execution_time'] = max_time
                result['failed_test_case'] = {
                    'id': test_case.get('id', i),
                    'input': test_case['input_data'],
                    'expected': test_case['output_data'],
                    'actual': actual_output
                }
                result['test_results'].append(test_result)
                logger.error(f"❌ 테스트케이스 {i + 1} 실패: 오답")
                logger.error(f"   기대: {test_case['output_data'][:100]}")
                logger.error(f"   실제: {actual_output[:100]}")
                return result

            result['test_results'].append(test_result)

        # 모든 테스트케이스 통과
        if result['passed'] == result['total']:
            result['status'] = SubmissionStatus.ACCEPTED.value
            result['execution_time'] = max_time
            logger.info(f"✅ 모든 테스트케이스 통과! ({result['passed']}/{result['total']})")

        return result
