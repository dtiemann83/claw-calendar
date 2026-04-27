import pytest
from unittest.mock import patch, MagicMock
from email_processor.models import Event
from email_processor.extractor import extract_event

SCHOOL_EMAIL = """
From: teacher@raleighoak.org
Subject: Music Field Trip - May 3rd

Dear Parents,

We are excited to announce a Music Field Trip to the Raleigh Amphitheater
on Saturday, May 3rd, 2026 from 9:00 AM to 3:00 PM.
Location: Raleigh Amphitheater, 500 S. McDowell St.

Please have students arrive by 8:45 AM.
"""

PROMO_EMAIL = """
From: deals@instacart.com
Subject: Your promo code expires soon!

Use code SAVE20 before it expires. Shop now for groceries.
"""

def make_mock_response(tool_input: dict | None):
    mock = MagicMock()
    if tool_input is None:
        mock.stop_reason = "end_turn"
        mock.content = [MagicMock(type="text", text="No calendar event found.")]
    else:
        tool_use = MagicMock()
        tool_use.type = "tool_use"
        tool_use.name = "record_event"
        tool_use.input = tool_input
        mock.stop_reason = "tool_use"
        mock.content = [tool_use]
    return mock

@pytest.mark.asyncio
async def test_extract_event_from_school_email():
    tool_input = {
        "title": "Music Field Trip",
        "date": "2026-05-03",
        "is_all_day": False,
        "time": "09:00",
        "end_time": "15:00",
        "location": "Raleigh Amphitheater, 500 S. McDowell St.",
        "description": "Music Field Trip to the Raleigh Amphitheater",
    }
    with patch("email_processor.extractor.anthropic_client") as mock_client:
        mock_client.messages.create.return_value = make_mock_response(tool_input)
        event = await extract_event(SCHOOL_EMAIL, "school")
    assert event is not None
    assert event.title == "Music Field Trip"
    assert event.date == "2026-05-03"
    assert event.time == "09:00"
    assert event.is_all_day is False

@pytest.mark.asyncio
async def test_extract_event_returns_none_for_promo():
    with patch("email_processor.extractor.anthropic_client") as mock_client:
        mock_client.messages.create.return_value = make_mock_response(None)
        event = await extract_event(PROMO_EMAIL, "general")
    assert event is None
