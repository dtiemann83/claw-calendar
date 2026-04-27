from dataclasses import dataclass

@dataclass
class Event:
    title: str
    date: str           # YYYY-MM-DD
    is_all_day: bool
    time: str | None    # HH:MM 24h local
    end_date: str | None
    end_time: str | None
    location: str | None
    description: str | None
