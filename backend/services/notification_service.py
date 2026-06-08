"""
Notification service — push notifications for anomaly alerts.
Currently stubbed. Will integrate FCM when needed.
"""

import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Send push notifications for anomaly alerts and updates."""

    @staticmethod
    async def send_anomaly_alert(user_id: str, alert_message: str) -> bool:
        """
        Send push notification for an anomaly alert.
        Stub implementation — logs instead of sending.
        """
        logger.info(f"[STUB] Push notification to {user_id}: {alert_message}")
        return True

    @staticmethod
    async def send_batch_update(user_id: str, batch_id: str, new_status: str) -> bool:
        """
        Notify farmer when their batch status changes.
        Stub implementation — logs instead of sending.
        """
        logger.info(
            f"[STUB] Batch update to {user_id}: Batch {batch_id} -> {new_status}"
        )
        return True
