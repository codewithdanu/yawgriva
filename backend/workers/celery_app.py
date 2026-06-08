"""
Celery application configuration.
Broker: Redis | Backend: Redis
"""

from celery import Celery
from celery.schedules import crontab

import os
redis_host = os.environ.get("REDIS_HOST", "cache")
redis_port = os.environ.get("REDIS_PORT", "6379")

celery_app = Celery(
    "yawgriva",
    broker=f"redis://{redis_host}:{redis_port}/0",
    backend=f"redis://{redis_host}:{redis_port}/1",
    include=[
        "workers.anomaly_worker",
        "workers.price_worker",
        "workers.freshness_worker",
        "workers.report_worker",
        "workers.vision_worker",
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Jakarta",
    enable_utc=True,
)

# Scheduled tasks
celery_app.conf.beat_schedule = {
    "scan-anomalies-every-30-min": {
        "task": "workers.anomaly_worker.scan_all_active_batches",
        "schedule": crontab(minute="*/30"),
    },
    "scrape-daily-prices-at-8am": {
        "task": "workers.price_worker.run_daily_price_scraping",
        "schedule": crontab(hour=8, minute=0),
    },
    # Feature 1: Freshness score update every 30 minutes
    "update-freshness-scores-every-30-min": {
        "task": "workers.freshness_worker.update_all_freshness_scores",
        "schedule": crontab(minute="*/30"),
    },
    # Feature 4: Weekly farm report every Monday at 07:00 WIB
    "generate-weekly-reports-monday-7am": {
        "task": "workers.report_worker.generate_all_farm_reports",
        "schedule": crontab(hour=7, minute=0, day_of_week="monday"),
    },
}

# Auto-discover tasks
celery_app.autodiscover_tasks(["workers"])
