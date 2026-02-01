import subprocess
import os
import tempfile
import time
import resource
import logging
from typing import Tuple, Optional
from models import SubmissionStatus

logger = logging.getLogger(__name__)

class CodeExecutor:
    def __init__(self, time_limit_ms: int, memory_limit_mb: int):
        self.time_limit_ms = time_limit_ms
        self.memory_limit_mb = memory_limit_mb
        self.time_limit_sec = time_limit_ms / 1000.0

    def compile_cpp(self, code: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        C++ 코드를 컴파일합니다.
        Returns: (성공 여부, 실행 파일 경로, 에러 메시지)
        """
        with tempfile.NamedTemporaryFile(mode='w', suffix='.cpp', delete=False) as f:
            f.write(code)
            source_file = f.name

        executable = source_file.replace('.cpp', '.out')

        try:
            # clang++ 또는 g++ 컴파일 시도
            compilers = ['clang++', 'g++']
            compile_error = None

            for compiler in compilers:
                try:
                    compile_process = subprocess.run(
                        [compiler, '-std=c++17', '-O2', '-o', executable, source_file],
                        capture_output=True,
                        text=True,
                        timeout=10
                    )
                    if compile_process.returncode == 0:
                        os.unlink(source_file)
                        return True, executable, None
                    compile_error = compile_process.stderr
                except FileNotFoundError:
                    continue

            # 모든 컴파일러 실패
            os.unlink(source_file)
            return False, None, compile_error or "C++ 컴파일러를 찾을 수 없습니다 (g++, clang++ 모두 없음)"

        except subprocess.TimeoutExpired:
            os.unlink(source_file)
            return False, None, "컴파일 시간 초과"
        except Exception as e:
            if os.path.exists(source_file):
                os.unlink(source_file)
            return False, None, str(e)

    def run_executable(self, executable: str, input_data: str) -> Tuple[str, str, int, int]:
        """
        컴파일된 실행 파일을 실행합니다.
        Returns: (상태, 출력/에러, 실행 시간(ms), 메모리(KB))
        """
        try:
            start_time = time.time()

            # 프로세스 실행
            process = subprocess.Popen(
                [executable],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                preexec_fn=self.set_limits
            )

            try:
                stdout, stderr = process.communicate(
                    input=input_data,
                    timeout=self.time_limit_sec
                )
                execution_time_ms = int((time.time() - start_time) * 1000)

                if process.returncode != 0:
                    return SubmissionStatus.RUNTIME_ERROR.value, stderr, execution_time_ms, 0

                return SubmissionStatus.JUDGING.value, stdout, execution_time_ms, 0

            except subprocess.TimeoutExpired:
                process.kill()
                return SubmissionStatus.TIME_LIMIT_EXCEEDED.value, "", self.time_limit_ms, 0

        except Exception as e:
            return SubmissionStatus.RUNTIME_ERROR.value, str(e), 0, 0

    def set_limits(self):
        """프로세스 리소스 제한 설정"""
        import sys

        try:
            # CPU 시간 제한 (초) - 대부분 OS에서 지원
            cpu_time_limit = int(self.time_limit_sec) + 1
            resource.setrlimit(resource.RLIMIT_CPU, (cpu_time_limit, cpu_time_limit))

            # 메모리 제한은 macOS에서 제대로 작동하지 않으므로 Linux에서만 적용
            if sys.platform == 'linux':
                memory_limit_bytes = self.memory_limit_mb * 1024 * 1024
                resource.setrlimit(resource.RLIMIT_AS, (memory_limit_bytes, memory_limit_bytes))
        except Exception as e:
            # 리소스 제한 설정 실패해도 계속 진행
            # macOS 등에서는 일부 제한이 작동하지 않을 수 있음
            logger.warning(f"⚠️ 리소스 제한 설정 실패 (무시하고 진행): {e}")

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
        Returns: {
            'status': str,
            'passed': int,
            'total': int,
            'execution_time': int,
            'memory_used': int,
            'error_message': str,
            'failed_test_case': dict,
            'test_results': list
        }
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

        # 컴파일
        compile_success, executable, compile_error = self.compile_cpp(code)
        if not compile_success:
            result['status'] = SubmissionStatus.COMPILE_ERROR.value
            result['error_message'] = compile_error
            return result

        result['status'] = SubmissionStatus.JUDGING.value

        try:
            max_time = 0
            max_memory = 0

            for i, test_case in enumerate(test_cases):
                # 진행률 로그
                progress = ((i + 1) / len(test_cases)) * 100
                logger.info(f"🔄 테스트케이스 검증 중: {i + 1}/{len(test_cases)} ({progress:.1f}%)")

                # 테스트케이스 실행
                status, output, exec_time, memory = self.run_executable(
                    executable,
                    test_case['input_data']
                )

                max_time = max(max_time, exec_time)
                max_memory = max(max_memory, memory)

                test_result = {
                    'test_case_id': test_case.get('id', i),
                    'status': status,
                    'execution_time': exec_time,
                    'passed': False
                }

                # 에러 발생
                if status != SubmissionStatus.JUDGING.value:
                    logger.error(f"❌ 테스트케이스 {i + 1} 실패: {status}")
                    logger.error(f"   입력: {test_case['input_data'][:100]}...")
                    logger.error(f"   기대 출력: {test_case['output_data'][:100]}...")
                    logger.error(f"   에러: {output[:200]}...")

                    result['status'] = status
                    result['execution_time'] = max_time
                    result['memory_used'] = max_memory
                    result['error_message'] = output
                    result['failed_test_case'] = {
                        'id': test_case.get('id', i),
                        'input': test_case['input_data'],
                        'expected': test_case['output_data'],
                        'actual': output
                    }
                    result['test_results'].append(test_result)
                    break

                # 출력 비교
                if self.compare_output(test_case['output_data'], output):
                    result['passed'] += 1
                    test_result['passed'] = True
                    logger.info(f"✅ 테스트케이스 {i + 1} 통과")
                else:
                    # 출력 형식 확인 (줄 수 차이)
                    expected_lines = len(test_case['output_data'].strip().split('\n'))
                    actual_lines = len(output.strip().split('\n'))

                    if expected_lines != actual_lines:
                        result['status'] = SubmissionStatus.PRESENTATION_ERROR.value
                        logger.error(f"❌ 테스트케이스 {i + 1} 실패: 출력 형식 오류 (기대 줄수: {expected_lines}, 실제 줄수: {actual_lines})")
                    else:
                        result['status'] = SubmissionStatus.WRONG_ANSWER.value
                        logger.error(f"❌ 테스트케이스 {i + 1} 실패: 오답")

                    logger.error(f"   입력: {test_case['input_data'][:100]}...")
                    logger.error(f"   기대 출력: {test_case['output_data'][:100]}...")
                    logger.error(f"   실제 출력: {output[:100]}...")

                    result['execution_time'] = max_time
                    result['memory_used'] = max_memory
                    result['failed_test_case'] = {
                        'id': test_case.get('id', i),
                        'input': test_case['input_data'],
                        'expected': test_case['output_data'],
                        'actual': output
                    }
                    result['test_results'].append(test_result)
                    break

                result['test_results'].append(test_result)

            # 모든 테스트케이스 통과
            if result['passed'] == result['total']:
                result['status'] = SubmissionStatus.ACCEPTED.value
                result['execution_time'] = max_time
                result['memory_used'] = max_memory
                logger.info(f"✅ 모든 테스트케이스 통과! ({result['passed']}/{result['total']})")

        finally:
            # 실행 파일 삭제
            if os.path.exists(executable):
                os.unlink(executable)

        return result
