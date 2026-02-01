from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float, Table, Enum as SQLEnum
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import enum

# 알고리즘 유형 정의
class AlgorithmType(str, enum.Enum):
    IMPLEMENTATION = "구현"
    DP = "다이나믹 프로그래밍"
    GREEDY = "그리디"
    GRAPH = "그래프"
    BFS = "너비 우선 탐색"
    DFS = "깊이 우선 탐색"
    DIJKSTRA = "다익스트라"
    FLOYD_WARSHALL = "플로이드 워셜"
    BACKTRACKING = "백트래킹"
    BINARY_SEARCH = "이진 탐색"
    PARAMETRIC_SEARCH = "파라메트릭 서치"
    TWO_POINTER = "투 포인터"
    SLIDING_WINDOW = "슬라이딩 윈도우"
    SORTING = "정렬"
    PRIORITY_QUEUE = "우선순위 큐"
    STACK = "스택"
    QUEUE = "큐"
    DEQUE = "덱"
    TREE = "트리"
    BINARY_TREE = "이진 트리"
    SEGMENT_TREE = "세그먼트 트리"
    FENWICK_TREE = "펜윅 트리"
    TRIE = "트라이"
    UNION_FIND = "유니온 파인드"
    MST = "최소 스패닝 트리"
    TOPOLOGICAL_SORT = "위상 정렬"
    SCC = "강한 연결 요소"
    ARTICULATION_POINT = "단절점"
    BRIDGE = "단절선"
    BIPARTITE_MATCHING = "이분 매칭"
    NETWORK_FLOW = "네트워크 플로우"
    STRING = "문자열"
    KMP = "KMP"
    RABIN_KARP = "라빈 카프"
    MANACHER = "매내처"
    SUFFIX_ARRAY = "접미사 배열"
    LCA = "최소 공통 조상"
    MATH = "수학"
    NUMBER_THEORY = "정수론"
    COMBINATORICS = "조합론"
    PROBABILITY = "확률론"
    GEOMETRY = "기하학"
    CONVEX_HULL = "볼록 껍질"
    LINE_SWEEPING = "라인 스위핑"
    BIT_MASKING = "비트마스킹"
    MEET_IN_THE_MIDDLE = "중간에서 만나기"
    DIVIDE_AND_CONQUER = "분할 정복"
    FFT = "고속 푸리에 변환"
    GAME_THEORY = "게임 이론"
    AD_HOC = "애드 혹"
    SIMULATION = "시뮬레이션"
    BRUTE_FORCE = "브루트포스"
    CONSTRUCTIVE = "구성적"
    HASHING = "해싱"
    SPARSE_TABLE = "스파스 테이블"
    SQRT_DECOMPOSITION = "제곱근 분할"
    MO_ALGORITHM = "Mo's 알고리즘"

# 제출 상태
class SubmissionStatus(str, enum.Enum):
    WAITING = "기다리는 중"
    PREPARING = "채점 준비 중"
    JUDGING = "채점 중"
    ACCEPTED = "맞았습니다"
    WRONG_ANSWER = "틀렸습니다"
    PRESENTATION_ERROR = "출력 형식이 잘못되었습니다"
    TIME_LIMIT_EXCEEDED = "시간 초과"
    MEMORY_LIMIT_EXCEEDED = "메모리 초과"
    OUTPUT_LIMIT_EXCEEDED = "출력 초과"
    RUNTIME_ERROR = "런타임 에러"
    COMPILE_ERROR = "컴파일 에러"

# 다대다 관계 테이블들
user_favorite_algorithms = Table(
    'user_favorite_algorithms',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('algorithm_type', String)
)

problem_algorithms = Table(
    'problem_algorithms',
    Base.metadata,
    Column('problem_id', Integer, ForeignKey('problems.id')),
    Column('algorithm_type', String)
)

friendships = Table(
    'friendships',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('friend_id', Integer, ForeignKey('users.id'))
)

# 사용자 모델
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    nickname = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)  # URL
    profile_background_url = Column(String, nullable=True)  # URL
    bio = Column(Text, nullable=True)
    favorite_algorithms = Column(Text, nullable=True)  # JSON string
    external_link_1 = Column(String, nullable=True)  # 외부 링크 1
    external_link_2 = Column(String, nullable=True)  # 외부 링크 2
    created_at = Column(DateTime, default=datetime.utcnow)

    # 관계
    problems_created = relationship("Problem", back_populates="creator")
    submissions = relationship("Submission", back_populates="user")
    questions = relationship("Question", back_populates="user")
    comments = relationship("Comment", back_populates="user")

    # 다대다 관계
    favorite_algorithms = Column(Text)  # JSON 문자열로 저장

    # 친구 관계 (자기 참조 다대다)
    friends = relationship(
        "User",
        secondary=friendships,
        primaryjoin=id == friendships.c.user_id,
        secondaryjoin=id == friendships.c.friend_id,
        backref="friend_of"
    )

# 문제 모델
class Problem(Base):
    __tablename__ = "problems"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=False)  # 마크다운 형식
    input_description = Column(Text, nullable=False)
    output_description = Column(Text, nullable=False)
    sample_input = Column(Text, nullable=False)
    sample_output = Column(Text, nullable=False)
    hint = Column(Text, nullable=True)

    time_limit = Column(Integer, nullable=False)  # 밀리초
    memory_limit = Column(Integer, nullable=False)  # MB
    difficulty = Column(Integer, nullable=False)  # 1-5

    creator_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    submission_count = Column(Integer, default=0)
    accepted_count = Column(Integer, default=0)

    # 관계
    creator = relationship("User", back_populates="problems_created")
    test_cases = relationship("TestCase", back_populates="problem", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="problem")
    questions = relationship("Question", back_populates="problem")

    # 다대다 관계
    algorithm_types = Column(Text)  # JSON 문자열로 저장

# 테스트케이스 모델
class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    problem_id = Column(Integer, ForeignKey("problems.id"))
    input_data = Column(Text, nullable=False)
    output_data = Column(Text, nullable=False)
    is_sample = Column(Boolean, default=False)  # 예제 여부

    problem = relationship("Problem", back_populates="test_cases")

# 제출 모델
class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    problem_id = Column(Integer, ForeignKey("problems.id"))
    code = Column(Text, nullable=False)
    status = Column(String, default=SubmissionStatus.WAITING.value)
    language = Column(String, default="cpp")

    execution_time = Column(Integer, nullable=True)  # 밀리초
    memory_used = Column(Integer, nullable=True)  # KB

    error_message = Column(Text, nullable=True)
    failed_test_case_id = Column(Integer, nullable=True)

    submitted_at = Column(DateTime, default=datetime.utcnow)

    # 관계
    user = relationship("User", back_populates="submissions")
    problem = relationship("Problem", back_populates="submissions")

# 질문 게시판 모델
class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    problem_id = Column(Integer, ForeignKey("problems.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 관계
    problem = relationship("Problem", back_populates="questions")
    user = relationship("User", back_populates="questions")
    comments = relationship("Comment", back_populates="question", cascade="all, delete-orphan")

# 댓글 모델
class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 관계
    question = relationship("Question", back_populates="comments")
    user = relationship("User", back_populates="comments")

# 스트릭 모델 (일일 활동 기록)
class Streak(Base):
    __tablename__ = "streaks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, nullable=False)
    problem_count = Column(Integer, default=0)
