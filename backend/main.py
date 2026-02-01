from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import json
import os
import shutil
import logging
import time

from database import engine, get_db, Base
import models
import schemas
from auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_current_user_optional,
    get_password_hash,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from judge import CodeExecutor

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 데이터베이스 테이블 생성
try:
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created successfully")
except Exception as e:
    logger.error(f"❌ Failed to create database tables: {e}")

app = FastAPI(title="Gladiator Online Judge")

logger.info("🚀 Gladiator Online Judge API starting...")

# CORS 설정 (가장 먼저 추가해야 함!)
# 환경변수에서 허용할 origin 목록 가져오기
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 요청/응답 로깅 미들웨어
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()

    # 요청 로그
    logger.info(f"📥 {request.method} {request.url.path}")
    if request.query_params:
        logger.info(f"   Query params: {dict(request.query_params)}")

    # 요청 처리
    response = await call_next(request)

    # 응답 로그
    process_time = time.time() - start_time
    logger.info(f"📤 {request.method} {request.url.path} - Status: {response.status_code} - Time: {process_time:.3f}s")

    return response

# 업로드 디렉토리 생성
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ============ 인증 API ============

@app.post("/api/auth/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """회원가입"""
    logger.info(f"👤 회원가입 시도: username={user.username}, email={user.email}")

    try:
        # 중복 확인 - 아이디
        existing_user = db.query(models.User).filter(models.User.username == user.username).first()
        if existing_user:
            logger.warning(f"❌ 회원가입 실패: 중복된 아이디 - {user.username}")
            raise HTTPException(
                status_code=400,
                detail=f"이미 존재하는 아이디입니다: '{user.username}'"
            )

        # 중복 확인 - 이메일
        existing_email = db.query(models.User).filter(models.User.email == user.email).first()
        if existing_email:
            logger.warning(f"❌ 회원가입 실패: 중복된 이메일 - {user.email}")
            raise HTTPException(
                status_code=400,
                detail=f"이미 존재하는 이메일입니다: '{user.email}'"
            )

        logger.info(f"✓ 중복 검사 통과")

        # 비밀번호 해싱
        logger.info(f"🔒 비밀번호 해싱 중...")
        hashed_password = get_password_hash(user.password)
        logger.info(f"✓ 비밀번호 해싱 완료")

        # 사용자 생성
        logger.info(f"💾 데이터베이스에 사용자 저장 중...")
        db_user = models.User(
            username=user.username,
            email=user.email,
            hashed_password=hashed_password,
            nickname=user.nickname or user.username,
            bio=user.bio,
            profile_image_url=user.profile_image_url,
            profile_background_url=user.profile_background_url,
            favorite_algorithms=json.dumps(user.favorite_algorithms if user.favorite_algorithms else [])
        )

        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        logger.info(f"✅ 회원가입 성공: user_id={db_user.id}, username={db_user.username}")

        # 응답 생성
        return schemas.UserResponse(
            id=db_user.id,
            username=db_user.username,
            email=db_user.email,
            nickname=db_user.nickname,
            profile_image_url=db_user.profile_image_url,
            profile_background_url=db_user.profile_background_url,
            bio=db_user.bio,
            favorite_algorithms=json.loads(db_user.favorite_algorithms),
            external_link_1=db_user.external_link_1,
            external_link_2=db_user.external_link_2,
            created_at=db_user.created_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 회원가입 중 예상치 못한 오류 발생: {str(e)}")
        logger.error(f"   오류 타입: {type(e).__name__}")
        import traceback
        logger.error(f"   스택 트레이스:\n{traceback.format_exc()}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"회원가입 처리 중 오류가 발생했습니다: {str(e)}"
        )

@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """로그인"""
    logger.info(f"🔐 로그인 시도: username={form_data.username}")

    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        logger.warning(f"❌ 로그인 실패: 인증 실패 - {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 일치하지 않습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    logger.info(f"✅ 로그인 성공: user_id={user.id}, username={user.username}")

    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보"""
    logger.info(f"ℹ️ 사용자 정보 조회: user_id={current_user.id}, username={current_user.username}")

    return schemas.UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        nickname=current_user.nickname,
        profile_image_url=current_user.profile_image_url,
        profile_background_url=current_user.profile_background_url,
        bio=current_user.bio,
        favorite_algorithms=json.loads(current_user.favorite_algorithms) if current_user.favorite_algorithms else [],
        external_link_1=current_user.external_link_1,
        external_link_2=current_user.external_link_2,
        created_at=current_user.created_at
    )

# ============ 프로필 API ============

@app.put("/api/profile", response_model=schemas.UserResponse)
def update_profile(
    profile: schemas.UserProfile,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """프로필 업데이트"""
    if profile.nickname is not None:
        current_user.nickname = profile.nickname
    if profile.profile_image_url is not None:
        current_user.profile_image_url = profile.profile_image_url
    if profile.profile_background_url is not None:
        current_user.profile_background_url = profile.profile_background_url
    if profile.bio is not None:
        current_user.bio = profile.bio
    if profile.favorite_algorithms is not None:
        if len(profile.favorite_algorithms) > 3:
            raise HTTPException(status_code=400, detail="선호 알고리즘은 최대 3개까지 선택 가능합니다")
        current_user.favorite_algorithms = json.dumps(profile.favorite_algorithms, ensure_ascii=False)
    if profile.external_link_1 is not None:
        current_user.external_link_1 = profile.external_link_1
    if profile.external_link_2 is not None:
        current_user.external_link_2 = profile.external_link_2

    db.commit()
    db.refresh(current_user)

    return schemas.UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        nickname=current_user.nickname,
        profile_image_url=current_user.profile_image_url,
        profile_background_url=current_user.profile_background_url,
        bio=current_user.bio,
        favorite_algorithms=json.loads(current_user.favorite_algorithms) if current_user.favorite_algorithms else [],
        external_link_1=current_user.external_link_1,
        external_link_2=current_user.external_link_2,
        created_at=current_user.created_at
    )

@app.get("/users/search", response_model=List[schemas.UserResponse])
def search_users(
    query: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자 검색 (아이디 또는 닉네임)"""
    if not query or len(query.strip()) == 0:
        return []

    search_term = f"%{query}%"
    users = db.query(models.User).filter(
        (models.User.username.like(search_term)) |
        (models.User.nickname.like(search_term))
    ).limit(10).all()

    result = []
    for user in users:
        result.append(schemas.UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            nickname=user.nickname,
            profile_image_url=user.profile_image_url,
            profile_background_url=user.profile_background_url,
            bio=user.bio,
            favorite_algorithms=json.loads(user.favorite_algorithms) if user.favorite_algorithms else [],
            external_link_1=user.external_link_1,
            external_link_2=user.external_link_2,
            created_at=user.created_at
        ))

    return result

@app.get("/users/{user_id}", response_model=schemas.UserResponse)
def get_user_by_id(user_id: int, db: Session = Depends(get_db)):
    """특정 사용자 정보 조회 (친구 프로필용)"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    return schemas.UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        nickname=user.nickname,
        profile_image_url=user.profile_image_url,
        profile_background_url=user.profile_background_url,
        bio=user.bio,
        favorite_algorithms=json.loads(user.favorite_algorithms) if user.favorite_algorithms else [],
        external_link_1=user.external_link_1,
        external_link_2=user.external_link_2,
        created_at=user.created_at
    )

@app.get("/api/profile/{user_id}", response_model=schemas.UserResponse)
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    """특정 사용자 프로필 조회"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    return schemas.UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        nickname=user.nickname,
        profile_image_url=user.profile_image_url,
        profile_background_url=user.profile_background_url,
        bio=user.bio,
        favorite_algorithms=json.loads(user.favorite_algorithms) if user.favorite_algorithms else [],
        external_link_1=user.external_link_1,
        external_link_2=user.external_link_2,
        created_at=user.created_at
    )

@app.get("/api/profile/{user_id}/stats", response_model=schemas.UserStats)
def get_user_stats(user_id: int, db: Session = Depends(get_db)):
    """사용자 통계 조회"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    # 문제 푼 수 (맞은 문제의 고유 개수)
    solved_problems = db.query(models.Submission.problem_id).filter(
        models.Submission.user_id == user_id,
        models.Submission.status == models.SubmissionStatus.ACCEPTED.value
    ).distinct().count()

    # 문제 만든 수
    created_problems = db.query(models.Problem).filter(
        models.Problem.creator_id == user_id
    ).count()

    # 제출 횟수
    attempt_count = db.query(models.Submission).filter(
        models.Submission.user_id == user_id
    ).count()

    # 맞은 제출 횟수
    accepted_count = db.query(models.Submission).filter(
        models.Submission.user_id == user_id,
        models.Submission.status == models.SubmissionStatus.ACCEPTED.value
    ).count()

    # 정답률
    accuracy_rate = (accepted_count / attempt_count * 100) if attempt_count > 0 else 0

    return schemas.UserStats(
        solved_count=solved_problems,
        created_count=created_problems,
        attempt_count=attempt_count,
        accepted_count=accepted_count,
        accuracy_rate=round(accuracy_rate, 2)
    )

@app.get("/api/profile/{user_id}/streak")
def get_user_streak(user_id: int, db: Session = Depends(get_db)):
    """사용자 스트릭 조회 (최근 1년)"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    # 최근 1년간의 제출 기록
    one_year_ago = datetime.utcnow() - timedelta(days=365)
    submissions = db.query(models.Submission).filter(
        models.Submission.user_id == user_id,
        models.Submission.status == models.SubmissionStatus.ACCEPTED.value,
        models.Submission.submitted_at >= one_year_ago
    ).all()

    # 날짜별 문제 수 집계
    streak_data = {}
    for submission in submissions:
        date_key = submission.submitted_at.strftime("%Y-%m-%d")
        if date_key not in streak_data:
            streak_data[date_key] = set()
        streak_data[date_key].add(submission.problem_id)

    # 결과 생성
    result = [
        {"date": date, "problem_count": len(problems)}
        for date, problems in sorted(streak_data.items())
    ]

    return result

@app.get("/api/profile/{user_id}/solved", response_model=List[schemas.ProblemListResponse])
def get_user_solved_problems(
    user_id: int,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """사용자가 푼 문제 목록"""
    # 맞은 문제 ID 조회
    solved_problem_ids = db.query(models.Submission.problem_id).filter(
        models.Submission.user_id == user_id,
        models.Submission.status == models.SubmissionStatus.ACCEPTED.value
    ).distinct().subquery()

    problems = db.query(models.Problem).filter(
        models.Problem.id.in_(solved_problem_ids)
    ).offset(skip).limit(limit).all()

    # 각 문제별로 해결한 사용자 수 계산
    problem_solved_counts = {}
    for p in problems:
        solved_count = db.query(models.Submission.user_id).filter(
            models.Submission.problem_id == p.id,
            models.Submission.status == models.SubmissionStatus.ACCEPTED.value
        ).distinct().count()
        problem_solved_counts[p.id] = solved_count

    return [
        schemas.ProblemListResponse(
            id=p.id,
            title=p.title,
            description=p.description,
            difficulty=p.difficulty,
            algorithm_types=json.loads(p.algorithm_types) if p.algorithm_types else [],
            submission_count=p.submission_count,
            accepted_count=p.accepted_count,
            solved_count=problem_solved_counts.get(p.id, 0),
            accuracy_rate=round((p.accepted_count / p.submission_count * 100) if p.submission_count > 0 else 0, 2),
            creator_id=p.creator_id
        )
        for p in problems
    ]

# ============ 문제 API ============

@app.get("/api/problems", response_model=List[schemas.ProblemListResponse])
def get_problems(
    skip: int = 0,
    limit: int = 20,
    difficulty: Optional[int] = None,
    algorithm: Optional[str] = None,
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """문제 목록 조회 (페이지네이션)"""
    query = db.query(models.Problem)

    if difficulty is not None:
        query = query.filter(models.Problem.difficulty == difficulty)

    if algorithm is not None:
        query = query.filter(models.Problem.algorithm_types.contains(algorithm))

    problems = query.offset(skip).limit(limit).all()

    # 각 문제별로 해결한 사용자 수 계산
    problem_solved_counts = {}
    for p in problems:
        solved_count = db.query(models.Submission.user_id).filter(
            models.Submission.problem_id == p.id,
            models.Submission.status == models.SubmissionStatus.ACCEPTED.value
        ).distinct().count()
        problem_solved_counts[p.id] = solved_count

    # 현재 사용자가 해결한 문제 목록
    user_solved_problems = set()
    if current_user:
        solved = db.query(models.Submission.problem_id).filter(
            models.Submission.user_id == current_user.id,
            models.Submission.status == models.SubmissionStatus.ACCEPTED.value
        ).distinct().all()
        user_solved_problems = {s[0] for s in solved}

    return [
        schemas.ProblemListResponse(
            id=p.id,
            title=p.title,
            description=p.description,
            difficulty=p.difficulty,
            algorithm_types=json.loads(p.algorithm_types) if p.algorithm_types else [],
            submission_count=p.submission_count,
            accepted_count=p.accepted_count,
            solved_count=problem_solved_counts.get(p.id, 0),
            accuracy_rate=round((p.accepted_count / p.submission_count * 100) if p.submission_count > 0 else 0, 2),
            creator_id=p.creator_id,
            is_solved=p.id in user_solved_problems
        )
        for p in problems
    ]

@app.get("/api/problems/{problem_id}")
def get_problem(problem_id: int, db: Session = Depends(get_db)):
    """문제 상세 조회"""
    problem = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다")

    # 샘플 테스트케이스만 포함
    sample_test_cases = db.query(models.TestCase).filter(
        models.TestCase.problem_id == problem_id,
        models.TestCase.is_sample == True
    ).all()

    creator = db.query(models.User).filter(models.User.id == problem.creator_id).first()

    return {
        "id": problem.id,
        "title": problem.title,
        "description": problem.description,
        "input_description": problem.input_description,
        "output_description": problem.output_description,
        "sample_input": problem.sample_input,
        "sample_output": problem.sample_output,
        "hint": problem.hint,
        "time_limit": problem.time_limit,
        "memory_limit": problem.memory_limit,
        "difficulty": problem.difficulty,
        "algorithm_types": json.loads(problem.algorithm_types) if problem.algorithm_types else [],
        "creator_id": problem.creator_id,
        "creator_username": creator.username if creator else "Unknown",
        "creator_nickname": creator.nickname if creator else None,
        "created_at": problem.created_at,
        "submission_count": problem.submission_count,
        "accepted_count": problem.accepted_count,
        "accuracy_rate": round((problem.accepted_count / problem.submission_count * 100) if problem.submission_count > 0 else 0, 2),
        "sample_test_cases": [
            {
                "id": tc.id,
                "input_data": tc.input_data,
                "output_data": tc.output_data
            }
            for tc in sample_test_cases
        ]
    }

@app.post("/api/problems", status_code=201)
def create_problem(
    problem: schemas.ProblemCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """문제 생성"""
    logger.info(f"📝 문제 생성 시도: user_id={current_user.id}, title={problem.title}, test_cases={len(problem.test_cases)}개")

    # 제작자의 코드로 테스트케이스 검증
    test_cases_data = [
        {
            'id': i,
            'input_data': tc.input_data,
            'output_data': tc.output_data
        }
        for i, tc in enumerate(problem.test_cases)
    ]

    logger.info(f"🔍 솔루션 코드 검증 시작...")

    executor = CodeExecutor(
        time_limit_ms=problem.time_limit,
        memory_limit_mb=problem.memory_limit
    )

    result = executor.judge(problem.solution_code, test_cases_data)

    logger.info(f"✓ 검증 결과: {result['status']}")

    if result['status'] != models.SubmissionStatus.ACCEPTED.value:
        logger.warning(f"❌ 문제 생성 실패: 솔루션 코드가 테스트케이스 통과 실패 - {result['status']}")

        # 실패한 테스트케이스 정보 구성
        error_detail = {
            'message': f"제작자의 코드가 모든 테스트케이스를 통과하지 못했습니다: {result['status']}",
            'status': result['status'],
            'passed': result['passed'],
            'total': result['total'],
            'error_message': result.get('error_message', ''),
            'failed_test_case': result.get('failed_test_case')
        }

        logger.error(f"   실패 상세: {error_detail}")

        raise HTTPException(
            status_code=400,
            detail=error_detail
        )

    # 문제 생성
    logger.info(f"💾 데이터베이스에 문제 저장 중...")

    db_problem = models.Problem(
        title=problem.title,
        description=problem.description,
        input_description=problem.input_description,
        output_description=problem.output_description,
        sample_input=problem.sample_input,
        sample_output=problem.sample_output,
        hint=problem.hint,
        time_limit=problem.time_limit,
        memory_limit=problem.memory_limit,
        difficulty=problem.difficulty,
        algorithm_types=json.dumps(problem.algorithm_types),
        creator_id=current_user.id
    )
    db.add(db_problem)
    db.commit()
    db.refresh(db_problem)

    logger.info(f"✅ 문제 생성 완료: problem_id={db_problem.id}, title={db_problem.title}")

    # 테스트케이스 생성
    logger.info(f"💾 테스트케이스 {len(problem.test_cases)}개 저장 중...")
    for tc in problem.test_cases:
        db_test_case = models.TestCase(
            problem_id=db_problem.id,
            input_data=tc.input_data,
            output_data=tc.output_data,
            is_sample=tc.is_sample
        )
        db.add(db_test_case)

    db.commit()
    logger.info(f"✅ 테스트케이스 저장 완료")

    return {"message": "문제가 성공적으로 생성되었습니다", "id": db_problem.id, "problem_id": db_problem.id}

@app.delete("/api/problems/{problem_id}")
def delete_problem(
    problem_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """문제 삭제 (작성자만 가능)"""
    problem = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다")

    # 작성자 확인
    if problem.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="문제를 삭제할 권한이 없습니다")

    # 테스트케이스 삭제
    db.query(models.TestCase).filter(models.TestCase.problem_id == problem_id).delete()

    # 제출 기록 삭제
    db.query(models.Submission).filter(models.Submission.problem_id == problem_id).delete()

    # 질문 및 댓글 삭제
    questions = db.query(models.Question).filter(models.Question.problem_id == problem_id).all()
    for question in questions:
        db.query(models.Comment).filter(models.Comment.question_id == question.id).delete()
    db.query(models.Question).filter(models.Question.problem_id == problem_id).delete()

    # 문제 삭제
    db.delete(problem)
    db.commit()

    logger.info(f"✅ 문제 삭제 완료: problem_id={problem_id}, user_id={current_user.id}")

    return {"message": "문제가 삭제되었습니다"}

@app.put("/api/problems/{problem_id}")
def update_problem(
    problem_id: int,
    problem_update: schemas.ProblemUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """문제 수정 (작성자만 가능)"""
    problem = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다")

    # 작성자 확인
    if problem.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="문제를 수정할 권한이 없습니다")

    # 문제 정보 업데이트
    if problem_update.title is not None:
        problem.title = problem_update.title
    if problem_update.description is not None:
        problem.description = problem_update.description
    if problem_update.input_description is not None:
        problem.input_description = problem_update.input_description
    if problem_update.output_description is not None:
        problem.output_description = problem_update.output_description
    if problem_update.sample_input is not None:
        problem.sample_input = problem_update.sample_input
    if problem_update.sample_output is not None:
        problem.sample_output = problem_update.sample_output
    if problem_update.hint is not None:
        problem.hint = problem_update.hint
    if problem_update.time_limit is not None:
        problem.time_limit = problem_update.time_limit
    if problem_update.memory_limit is not None:
        problem.memory_limit = problem_update.memory_limit
    if problem_update.difficulty is not None:
        problem.difficulty = problem_update.difficulty
    if problem_update.algorithm_types is not None:
        problem.algorithm_types = json.dumps(problem_update.algorithm_types)

    db.commit()
    db.refresh(problem)

    logger.info(f"✅ 문제 수정 완료: problem_id={problem_id}, user_id={current_user.id}")

    return {"message": "문제가 수정되었습니다", "id": problem.id}

# ============ 제출 API ============

@app.post("/api/submissions")
async def submit_code(
    file: UploadFile = File(...),
    problem_id: int = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """코드 제출"""
    # C++ 파일 확인
    if not file.filename.endswith('.cpp'):
        raise HTTPException(status_code=400, detail="C++ 파일만 제출 가능합니다")

    # 문제 확인
    problem = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다")

    # 코드 읽기
    code = await file.read()
    code = code.decode('utf-8')

    # 제출 생성
    submission = models.Submission(
        user_id=current_user.id,
        problem_id=problem_id,
        code=code,
        status=models.SubmissionStatus.WAITING.value
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # 문제의 제출 횟수 증가
    problem.submission_count += 1
    db.commit()

    # 테스트케이스 가져오기
    test_cases = db.query(models.TestCase).filter(
        models.TestCase.problem_id == problem_id
    ).all()

    test_cases_data = [
        {
            'id': tc.id,
            'input_data': tc.input_data,
            'output_data': tc.output_data
        }
        for tc in test_cases
    ]

    # 채점
    executor = CodeExecutor(
        time_limit_ms=problem.time_limit,
        memory_limit_mb=problem.memory_limit
    )

    result = executor.judge(code, test_cases_data)

    # 제출 상태 업데이트
    submission.status = result['status']
    submission.execution_time = result['execution_time']
    submission.memory_used = result['memory_used']
    submission.error_message = result.get('error_message')

    if result.get('failed_test_case'):
        submission.failed_test_case_id = result['failed_test_case']['id']

    # 맞았을 경우 문제의 정답 횟수 증가
    if result['status'] == models.SubmissionStatus.ACCEPTED.value:
        problem.accepted_count += 1

        # 스트릭 업데이트 (KST 기준)
        from datetime import timedelta
        kst_now = datetime.utcnow() + timedelta(hours=9)  # KST = UTC+9
        today = kst_now.replace(hour=0, minute=0, second=0, microsecond=0)

        logger.info(f"🔍 스트릭 체크: user_id={current_user.id}, problem_id={problem.id}, KST={kst_now}, today={today}")

        # 이미 오늘 이 문제를 푼 적이 있는지 확인
        already_solved_today = db.query(models.Submission).filter(
            models.Submission.user_id == current_user.id,
            models.Submission.problem_id == problem.id,
            models.Submission.status == models.SubmissionStatus.ACCEPTED.value,
            models.Submission.id < submission.id  # 이전 제출들만 확인
        ).first()

        logger.info(f"🔍 오늘 이 문제를 이미 풀었나? {already_solved_today is not None}")

        # 오늘 처음 푼 문제라면 스트릭 업데이트
        if not already_solved_today:
            streak = db.query(models.Streak).filter(
                models.Streak.user_id == current_user.id,
                models.Streak.date == today
            ).first()

            if not streak:
                streak = models.Streak(
                    user_id=current_user.id,
                    date=today,
                    problem_count=1
                )
                db.add(streak)
                logger.info(f"✅ 스트릭 생성: user_id={current_user.id}, date={today}, count=1")
            else:
                streak.problem_count += 1
                logger.info(f"✅ 스트릭 업데이트: user_id={current_user.id}, date={today}, count={streak.problem_count}")

    db.commit()
    db.refresh(submission)

    # 응답 생성
    response = {
        "submission_id": submission.id,
        "status": submission.status,
        "execution_time": submission.execution_time,
        "memory_used": submission.memory_used,
        "passed": result['passed'],
        "total": result['total'],
        "test_results": result.get('test_results', [])
    }

    # 실패한 테스트케이스 정보 (어떤 경우든 포함)
    if result.get('failed_test_case'):
        response['failed_test_case'] = result['failed_test_case']

    if result.get('error_message'):
        response['error_message'] = result['error_message']

    # 모든 테스트케이스 정보 제공 (통과/실패 여부와 함께)
    response['all_test_cases'] = [
        {
            'id': i + 1,
            'input': tc['input_data'],
            'expected_output': tc['output_data'],
            'passed': i < result['passed']  # passed 개수만큼은 통과한 것
        }
        for i, tc in enumerate(test_cases_data)
    ]

    return response

@app.get("/api/submissions/{submission_id}")
def get_submission(submission_id: int, db: Session = Depends(get_db)):
    """제출 상세 조회"""
    submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="제출을 찾을 수 없습니다")

    user = db.query(models.User).filter(models.User.id == submission.user_id).first()
    problem = db.query(models.Problem).filter(models.Problem.id == submission.problem_id).first()

    # 테스트케이스 정보 가져오기
    test_cases = db.query(models.TestCase).filter(
        models.TestCase.problem_id == submission.problem_id
    ).all()

    # 기본 응답
    response = {
        "id": submission.id,
        "user_id": submission.user_id,
        "username": user.username if user else "Unknown",
        "problem_id": submission.problem_id,
        "code": submission.code,
        "status": submission.status,
        "execution_time": submission.execution_time,
        "memory_used": submission.memory_used,
        "error_message": submission.error_message,
        "submitted_at": submission.submitted_at
    }

    # 테스트케이스 결과 재구성
    if test_cases:
        total_tests = len(test_cases)

        # 모든 테스트케이스 정보 (통과/실패 여부 포함)
        all_test_cases = []
        passed_count = 0

        # 실패한 테스트케이스가 있으면 그 전까지는 통과
        if submission.failed_test_case_id:
            failed_tc = db.query(models.TestCase).filter(
                models.TestCase.id == submission.failed_test_case_id
            ).first()

            if failed_tc:
                # 실패한 테스트케이스의 인덱스 찾기
                for idx, tc in enumerate(test_cases):
                    if tc.id == submission.failed_test_case_id:
                        passed_count = idx
                        break
        elif submission.status == models.SubmissionStatus.ACCEPTED.value:
            # 모두 통과
            passed_count = total_tests

        for idx, tc in enumerate(test_cases):
            all_test_cases.append({
                'id': idx + 1,
                'input': tc.input_data,
                'expected_output': tc.output_data,
                'passed': idx < passed_count
            })

        response['all_test_cases'] = all_test_cases
        response['passed'] = passed_count
        response['total'] = total_tests

        # 실패한 테스트케이스 상세 정보
        if submission.failed_test_case_id:
            failed_tc = db.query(models.TestCase).filter(
                models.TestCase.id == submission.failed_test_case_id
            ).first()

            if failed_tc:
                # 실패한 테스트케이스의 인덱스 찾기
                tc_index = 0
                for idx, tc in enumerate(test_cases):
                    if tc.id == submission.failed_test_case_id:
                        tc_index = idx + 1
                        break

                response['failed_test_case'] = {
                    'id': tc_index,
                    'input': failed_tc.input_data,
                    'expected': failed_tc.output_data,
                    'actual': submission.error_message if submission.status == models.SubmissionStatus.WRONG_ANSWER.value else ''
                }

    return response

@app.get("/api/problems/{problem_id}/submissions")
def get_problem_submissions(
    problem_id: int,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """문제의 제출 현황"""
    submissions = db.query(models.Submission).filter(
        models.Submission.problem_id == problem_id
    ).order_by(models.Submission.submitted_at.desc()).offset(skip).limit(limit).all()

    result = []
    for submission in submissions:
        user = db.query(models.User).filter(models.User.id == submission.user_id).first()
        result.append({
            "id": submission.id,
            "user_id": submission.user_id,
            "username": user.username if user else "Unknown",
            "status": submission.status,
            "execution_time": submission.execution_time,
            "memory_used": submission.memory_used,
            "submitted_at": submission.submitted_at
        })

    return result

@app.get("/api/problems/{problem_id}/accepted-users")
def get_accepted_users(problem_id: int, db: Session = Depends(get_db)):
    """문제를 맞힌 사람 목록"""
    # 맞은 사람의 user_id 중복 제거
    accepted_user_ids = db.query(models.Submission.user_id).filter(
        models.Submission.problem_id == problem_id,
        models.Submission.status == models.SubmissionStatus.ACCEPTED.value
    ).distinct().all()

    user_ids = [uid[0] for uid in accepted_user_ids]
    users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()

    return [
        {
            "id": user.id,
            "username": user.username,
            "nickname": user.nickname,
            "profile_image_url": user.profile_image_url
        }
        for user in users
    ]

# ============ 질문 게시판 API ============

@app.post("/api/questions", status_code=201)
def create_question(
    question: schemas.QuestionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """질문 생성"""
    problem = db.query(models.Problem).filter(models.Problem.id == question.problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다")

    db_question = models.Question(
        problem_id=question.problem_id,
        user_id=current_user.id,
        title=question.title,
        content=question.content
    )
    db.add(db_question)
    db.commit()
    db.refresh(db_question)

    return {"message": "질문이 작성되었습니다", "question_id": db_question.id}

@app.get("/api/problems/{problem_id}/questions")
def get_problem_questions(
    problem_id: int,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """문제의 질문 목록"""
    questions = db.query(models.Question).filter(
        models.Question.problem_id == problem_id
    ).order_by(models.Question.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for q in questions:
        user = db.query(models.User).filter(models.User.id == q.user_id).first()
        comment_count = db.query(models.Comment).filter(models.Comment.question_id == q.id).count()

        result.append({
            "id": q.id,
            "problem_id": q.problem_id,
            "user_id": q.user_id,
            "username": user.username if user else "Unknown",
            "title": q.title,
            "content": q.content,
            "created_at": q.created_at,
            "updated_at": q.updated_at,
            "comment_count": comment_count
        })

    return result

@app.get("/api/questions/{question_id}")
def get_question(question_id: int, db: Session = Depends(get_db)):
    """질문 상세 조회"""
    question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="질문을 찾을 수 없습니다")

    user = db.query(models.User).filter(models.User.id == question.user_id).first()
    comments = db.query(models.Comment).filter(
        models.Comment.question_id == question_id
    ).order_by(models.Comment.created_at).all()

    comment_list = []
    for c in comments:
        comment_user = db.query(models.User).filter(models.User.id == c.user_id).first()
        comment_list.append({
            "id": c.id,
            "user_id": c.user_id,
            "username": comment_user.username if comment_user else "Unknown",
            "content": c.content,
            "created_at": c.created_at,
            "updated_at": c.updated_at
        })

    return {
        "id": question.id,
        "problem_id": question.problem_id,
        "user_id": question.user_id,
        "username": user.username if user else "Unknown",
        "title": question.title,
        "content": question.content,
        "created_at": question.created_at,
        "updated_at": question.updated_at,
        "comments": comment_list
    }

@app.post("/api/comments", status_code=201)
def create_comment(
    comment: schemas.CommentCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """댓글 생성"""
    question = db.query(models.Question).filter(models.Question.id == comment.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="질문을 찾을 수 없습니다")

    db_comment = models.Comment(
        question_id=comment.question_id,
        user_id=current_user.id,
        content=comment.content
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)

    return {"message": "댓글이 작성되었습니다", "comment_id": db_comment.id}

# ============ 친구 API ============

@app.post("/friends/{friend_id}", status_code=201)
def add_friend_by_id(
    friend_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """친구 추가 (ID로)"""
    friend = db.query(models.User).filter(models.User.id == friend_id).first()
    if not friend:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    if friend.id == current_user.id:
        raise HTTPException(status_code=400, detail="자기 자신을 친구로 추가할 수 없습니다")

    # 이미 친구인지 확인
    if friend in current_user.friends:
        raise HTTPException(status_code=400, detail="이미 친구입니다")

    current_user.friends.append(friend)
    db.commit()

    return {"message": "친구가 추가되었습니다"}

@app.post("/api/friends", status_code=201)
def add_friend(
    friend_request: schemas.FriendRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """친구 추가"""
    friend = db.query(models.User).filter(models.User.username == friend_request.friend_username).first()
    if not friend:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    if friend.id == current_user.id:
        raise HTTPException(status_code=400, detail="자기 자신을 친구로 추가할 수 없습니다")

    # 이미 친구인지 확인
    if friend in current_user.friends:
        raise HTTPException(status_code=400, detail="이미 친구입니다")

    current_user.friends.append(friend)
    db.commit()

    return {"message": "친구가 추가되었습니다"}

@app.get("/friends")
def get_friends_list(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """친구 목록"""
    friends = current_user.friends

    return [
        {
            "id": friend.id,
            "username": friend.username,
            "nickname": friend.nickname,
            "profile_image_url": friend.profile_image_url,
            "profile_background_url": friend.profile_background_url,
            "bio": friend.bio,
            "favorite_algorithms": json.loads(friend.favorite_algorithms) if friend.favorite_algorithms else [],
            "external_link_1": friend.external_link_1,
            "external_link_2": friend.external_link_2
        }
        for friend in friends
    ]

@app.get("/api/friends")
def get_friends(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """친구 목록"""
    friends = current_user.friends

    return [
        {
            "id": friend.id,
            "username": friend.username,
            "nickname": friend.nickname,
            "profile_image_url": friend.profile_image_url,
            "profile_background_url": friend.profile_background_url,
            "bio": friend.bio,
            "favorite_algorithms": json.loads(friend.favorite_algorithms) if friend.favorite_algorithms else [],
            "external_link_1": friend.external_link_1,
            "external_link_2": friend.external_link_2
        }
        for friend in friends
    ]

@app.delete("/friends/{friend_id}")
def remove_friend_by_id(
    friend_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """친구 삭제 (ID로)"""
    friend = db.query(models.User).filter(models.User.id == friend_id).first()
    if not friend:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    if friend not in current_user.friends:
        raise HTTPException(status_code=400, detail="친구가 아닙니다")

    current_user.friends.remove(friend)
    db.commit()

    return {"message": "친구가 삭제되었습니다"}

@app.delete("/api/friends/{friend_id}")
def remove_friend(
    friend_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """친구 삭제"""
    friend = db.query(models.User).filter(models.User.id == friend_id).first()
    if not friend:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    if friend not in current_user.friends:
        raise HTTPException(status_code=400, detail="친구가 아닙니다")

    current_user.friends.remove(friend)
    db.commit()

    return {"message": "친구가 삭제되었습니다"}

# ============ 알고리즘 유형 목록 API ============

@app.get("/api/algorithms")
def get_algorithm_types():
    """알고리즘 유형 목록"""
    return [algo.value for algo in models.AlgorithmType]

# ============ 헬스체크 ============

@app.get("/")
def read_root():
    return {"message": "Gladiator Online Judge API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
