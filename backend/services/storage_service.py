"""
MinIO Storage Service for S3-compatible object storage.
Handles file uploads and retrievals for checkpoint photos.
"""

import boto3
import json
import logging
from botocore.client import Config
from core.config import settings

logger = logging.getLogger(__name__)


class MinioStorageService:
    def __init__(self):
        self.endpoint = settings.MINIO_ENDPOINT
        self.external_endpoint = settings.MINIO_EXTERNAL_ENDPOINT
        self.access_key = settings.MINIO_ACCESS_KEY
        self.secret_key = settings.MINIO_SECRET_KEY
        self.bucket_name = settings.MINIO_BUCKET

        self.s3_client = boto3.client(
            "s3",
            endpoint_url=self.endpoint,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(signature_version="s3v4"),
        )
        self._initialized = False

    def ensure_bucket_exists(self):
        """Ensure the MinIO bucket exists and set it to public-read."""
        if self._initialized:
            return
        try:
            # Check if bucket exists
            try:
                self.s3_client.head_bucket(Bucket=self.bucket_name)
            except self.s3_client.exceptions.ClientError:
                # Create bucket
                self.s3_client.create_bucket(Bucket=self.bucket_name)
                
                # Set public read policy
                policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Sid": "PublicRead",
                            "Effect": "Allow",
                            "Principal": "*",
                            "Action": ["s3:GetObject"],
                            "Resource": [f"arn:aws:s3:::{self.bucket_name}/*"]
                        }
                    ]
                }
                self.s3_client.put_bucket_policy(
                    Bucket=self.bucket_name,
                    Policy=json.dumps(policy)
                )
                logger.info(f"MinIO bucket '{self.bucket_name}' created with public-read policy.")
            self._initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize MinIO bucket: {e}")

    def upload_file(self, file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
        """Upload file bytes to MinIO and return the public external URL."""
        self.ensure_bucket_exists()
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=filename,
                Body=file_bytes,
                ContentType=content_type
            )
            # URL for external client (browser) access
            url = f"{self.external_endpoint}/{self.bucket_name}/{filename}"
            logger.info(f"File uploaded to MinIO: {url}")
            return url
        except Exception as e:
            logger.error(f"Failed to upload file to MinIO: {e}")
            raise e

    def get_file(self, filename: str) -> bytes:
        """Retrieve file bytes from MinIO."""
        self.ensure_bucket_exists()
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=filename
            )
            return response["Body"].read()
        except Exception as e:
            logger.error(f"Failed to read file from MinIO: {e}")
            raise e


storage_service = MinioStorageService()
