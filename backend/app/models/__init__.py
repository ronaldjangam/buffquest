"""Import model classes so SQLAlchemy relationship strings resolve reliably."""

from app.models.attendance import AttendanceSubmission, AttendanceVerificationStatus
from app.models.building_zone import BuildingZone
from app.models.message import Message
from app.models.profile import Profile
from app.models.quest import ModerationStatus, Quest, QuestStatus
from app.models.reward_log import RewardLog, RewardSourceType

__all__ = [
	"AttendanceSubmission",
	"AttendanceVerificationStatus",
	"BuildingZone",
	"Message",
	"ModerationStatus",
	"Profile",
	"Quest",
	"QuestStatus",
	"RewardLog",
	"RewardSourceType",
]
