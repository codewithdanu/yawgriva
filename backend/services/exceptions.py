"""Custom exceptions for the horticultural price scraper service."""

class DataUnavailableError(Exception):
    """Exception raised when all price data sources fail to return data."""
    pass

class ParseError(Exception):
    """Exception raised when a data source response does not match the expected schema."""
    pass

class RateLimitError(Exception):
    """Exception raised when an HTTP 429 Rate Limit error occurs."""
    
    def __init__(self, message: str, retry_after: str | None = None):
        super().__init__(message)
        self.retry_after = retry_after
