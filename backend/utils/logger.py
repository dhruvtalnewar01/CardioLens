"""Structured logging with structlog for clinical audit trail."""
import structlog
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings


def setup_logging() -> None:
    """Configure structlog with JSON output for production, console for dev."""
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.TimeStamper(fmt="iso"),
    ]

    if settings.environment == "production":
        shared_processors.append(structlog.processors.JSONRenderer())
    else:
        shared_processors.append(structlog.dev.ConsoleRenderer())

    structlog.configure(
        processors=shared_processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper(), logging.INFO)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = __name__) -> structlog.BoundLogger:
    """Get a bound logger for a module."""
    setup_logging()
    return structlog.get_logger(name)


# PII masking for audit safety
PII_FIELDS = {"first_name", "last_name", "mrn", "dob", "ssn", "phone", "email", "address"}


def mask_pii(data: dict) -> dict:
    """Mask personally identifiable information in log output."""
    masked = {}
    for key, value in data.items():
        if key.lower() in PII_FIELDS:
            masked[key] = "***REDACTED***"
        elif isinstance(value, dict):
            masked[key] = mask_pii(value)
        else:
            masked[key] = value
    return masked
