import anthropic
from .models import Event

anthropic_client = anthropic.Anthropic()

_RECORD_EVENT_TOOL = {
    "name": "record_event",
    "description": "Record a calendar event found in this email. Only call this tool if the email contains a specific event with a date.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title":       {"type": "string", "description": "Short event title"},
            "date":        {"type": "string", "description": "YYYY-MM-DD"},
            "is_all_day":  {"type": "boolean"},
            "time":        {"type": ["string", "null"], "description": "HH:MM 24h, null if all-day or unknown"},
            "end_date":    {"type": ["string", "null"], "description": "YYYY-MM-DD, null if same day"},
            "end_time":    {"type": ["string", "null"], "description": "HH:MM 24h"},
            "location":    {"type": ["string", "null"]},
            "description": {"type": ["string", "null"], "description": "1-2 sentence summary"},
        },
        "required": ["title", "date", "is_all_day"],
    },
}

_SYSTEM = (
    "You extract calendar events from emails. "
    "Call record_event if and only if the email contains a specific appointment, "
    "meeting, game, field trip, or other dateable event. "
    "Do NOT call it for receipts, newsletters, promotions, or general updates."
)

async def extract_event(content: str, tag: str) -> Event | None:
    response = anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=_SYSTEM,
        tools=[_RECORD_EVENT_TOOL],
        messages=[{
            "role": "user",
            "content": f"Calendar tag for this address: {tag}\n\nEmail:\n{content}",
        }],
    )
    for block in response.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "record_event":
            i = block.input
            return Event(
                title=i["title"],
                date=i["date"],
                is_all_day=i.get("is_all_day", False),
                time=i.get("time"),
                end_date=i.get("end_date"),
                end_time=i.get("end_time"),
                location=i.get("location"),
                description=i.get("description"),
            )
    return None
