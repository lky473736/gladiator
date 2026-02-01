from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime
from models import AlgorithmType, SubmissionStatus
import re

# 사용자 스키마
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str
    nickname: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    profile_background_url: Optional[str] = None
    favorite_algorithms: Optional[List[str]] = []

    @validator('username')
    def validate_username(cls, v):
        if not v:
            raise ValueError('아이디를 입력해주세요')
        if len(v) < 3:
            raise ValueError('아이디는 3자 이상이어야 합니다')
        if len(v) > 20:
            raise ValueError('아이디는 20자 이하여야 합니다')
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('아이디는 영문, 숫자, 언더스코어(_)만 사용 가능합니다')
        if v[0].isdigit():
            raise ValueError('아이디는 숫자로 시작할 수 없습니다')
        return v

    @validator('password')
    def validate_password(cls, v):
        if not v:
            raise ValueError('비밀번호를 입력해주세요')
        if len(v) < 8:
            raise ValueError('비밀번호는 8자 이상이어야 합니다')
        if len(v) > 50:
            raise ValueError('비밀번호는 50자 이하여야 합니다')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('비밀번호는 영문을 포함해야 합니다')
        if not re.search(r'\d', v):
            raise ValueError('비밀번호는 숫자를 포함해야 합니다')
        if v.lower() in ['password', '12345678', 'qwerty123', 'password123']:
            raise ValueError('너무 단순한 비밀번호입니다')
        return v

    @validator('email')
    def validate_email(cls, v):
        if not v:
            raise ValueError('이메일을 입력해주세요')
        # 이메일 도메인 검증
        email_parts = str(v).split('@')
        if len(email_parts) != 2:
            raise ValueError('올바른 이메일 형식이 아닙니다')
        domain = email_parts[1].lower()
        # 일반적이지 않은 도메인 차단
        if '.' not in domain:
            raise ValueError('올바른 이메일 도메인이 아닙니다')
        return v

    @validator('nickname')
    def validate_nickname(cls, v):
        if v is not None:
            if len(v) > 30:
                raise ValueError('닉네임은 30자 이하여야 합니다')
            if len(v.strip()) == 0:
                raise ValueError('닉네임은 공백만으로 구성될 수 없습니다')
        return v

    @validator('bio')
    def validate_bio(cls, v):
        if v is not None and len(v) > 500:
            raise ValueError('자기소개는 500자 이하여야 합니다')
        return v

class UserLogin(BaseModel):
    username: str
    password: str

class UserProfile(BaseModel):
    nickname: Optional[str] = None
    profile_image_url: Optional[str] = None
    profile_background_url: Optional[str] = None
    bio: Optional[str] = None
    favorite_algorithms: Optional[List[str]] = []
    external_link_1: Optional[str] = None
    external_link_2: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    nickname: Optional[str] = None
    profile_image_url: Optional[str] = None
    profile_background_url: Optional[str] = None
    bio: Optional[str] = None
    favorite_algorithms: List[str]
    external_link_1: Optional[str] = None
    external_link_2: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserStats(BaseModel):
    solved_count: int
    created_count: int
    attempt_count: int
    accepted_count: int
    accuracy_rate: float

# 토큰 스키마
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# 문제 스키마
class TestCaseCreate(BaseModel):
    input_data: str
    output_data: str
    is_sample: bool = False

class TestCaseResponse(BaseModel):
    id: int
    input_data: str
    output_data: str
    is_sample: bool

    class Config:
        from_attributes = True

class ProblemCreate(BaseModel):
    title: str
    description: str
    input_description: str
    output_description: str
    sample_input: str
    sample_output: str
    hint: Optional[str] = None
    time_limit: int
    memory_limit: int
    difficulty: int
    algorithm_types: List[str]
    test_cases: List[TestCaseCreate]
    solution_code: str  # 검증용 코드

    @validator('difficulty')
    def validate_difficulty(cls, v):
        if v < 1 or v > 5:
            raise ValueError('난이도는 1-5 사이여야 합니다')
        return v

    @validator('test_cases')
    def validate_test_cases(cls, v):
        if len(v) < 10:
            raise ValueError('테스트케이스는 최소 10개 이상이어야 합니다')
        return v

class ProblemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    input_description: Optional[str] = None
    output_description: Optional[str] = None
    sample_input: Optional[str] = None
    sample_output: Optional[str] = None
    hint: Optional[str] = None
    time_limit: Optional[int] = None
    memory_limit: Optional[int] = None
    difficulty: Optional[int] = None
    algorithm_types: Optional[List[str]] = None

    @validator('difficulty')
    def validate_difficulty(cls, v):
        if v is not None and (v < 1 or v > 5):
            raise ValueError('난이도는 1-5 사이여야 합니다')
        return v

class ProblemResponse(BaseModel):
    id: int
    title: str
    description: str
    input_description: str
    output_description: str
    sample_input: str
    sample_output: str
    hint: Optional[str] = None
    time_limit: int
    memory_limit: int
    difficulty: int
    algorithm_types: List[str]
    creator_id: int
    created_at: datetime
    submission_count: int
    accepted_count: int
    accuracy_rate: float

    class Config:
        from_attributes = True

class ProblemListResponse(BaseModel):
    id: int
    title: str
    description: str
    difficulty: int
    algorithm_types: List[str]
    submission_count: int
    accepted_count: int
    solved_count: int  # 이 문제를 푼 사용자 수
    accuracy_rate: float
    creator_id: int
    is_solved: bool = False  # 현재 사용자가 이 문제를 풀었는지

    class Config:
        from_attributes = True

class ProblemDetailResponse(ProblemResponse):
    test_cases: List[TestCaseResponse]
    creator_username: str

# 제출 스키마
class SubmissionCreate(BaseModel):
    problem_id: int
    code: str

class SubmissionResponse(BaseModel):
    id: int
    user_id: int
    problem_id: int
    status: str
    execution_time: Optional[int] = None
    memory_used: Optional[int] = None
    error_message: Optional[str] = None
    failed_test_case_id: Optional[int] = None
    submitted_at: datetime
    username: str

    class Config:
        from_attributes = True

class SubmissionDetailResponse(SubmissionResponse):
    code: str
    test_results: Optional[List[dict]] = None

# 질문 게시판 스키마
class QuestionCreate(BaseModel):
    problem_id: int
    title: str
    content: str

class QuestionResponse(BaseModel):
    id: int
    problem_id: int
    user_id: int
    title: str
    content: str
    created_at: datetime
    updated_at: datetime
    username: str
    comment_count: int

    class Config:
        from_attributes = True

class CommentCreate(BaseModel):
    question_id: int
    content: str

class CommentResponse(BaseModel):
    id: int
    question_id: int
    user_id: int
    content: str
    created_at: datetime
    updated_at: datetime
    username: str

    class Config:
        from_attributes = True

# 친구 스키마
class FriendRequest(BaseModel):
    friend_username: str

class FriendResponse(BaseModel):
    id: int
    username: str
    nickname: Optional[str] = None
    profile_image_url: Optional[str] = None

    class Config:
        from_attributes = True

# 스트릭 스키마
class StreakResponse(BaseModel):
    date: str
    problem_count: int

    class Config:
        from_attributes = True
