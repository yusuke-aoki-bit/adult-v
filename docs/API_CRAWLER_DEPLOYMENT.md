# API Crawler Deployment Guide

**Date**: 2025-11-26
**Status**: Production Ready

## Overview

This document describes the deployment of DUGA and SOKMIL API crawlers to Google Cloud Run Jobs with automated Cloud Scheduler triggers.

## Components Deployed

### 1. DUGA API Crawler

**Purpose**: Fetch new releases from DUGA API and store in database

**Files**:
- [Dockerfile.duga-api](../Dockerfile.duga-api) - Container definition
- [cloudbuild-duga-api.yaml](../cloudbuild-duga-api.yaml) - Cloud Build configuration
- [crawl-duga-api.ts](../scripts/crawlers/crawl-duga-api.ts) - Crawler implementation

**Configuration**:
- Image: `gcr.io/adult-v/duga-api-crawler:latest`
- Region: `asia-northeast1`
- Timeout: 30 minutes
- Schedule: Daily at 2:00 AM JST
- Default args: `--limit=200 --offset=0`

**Environment Variables**:
```bash
DATABASE_URL=postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres
DUGA_APP_ID=WzsUOEt2124UD65BqsHU
DUGA_AGENT_ID=48611
```

### 2. SOKMIL API Crawler

**Purpose**: Fetch new releases from SOKMIL API and store in database

**Files**:
- [Dockerfile.sokmil-api](../Dockerfile.sokmil-api) - Container definition
- [cloudbuild-sokmil-api.yaml](../cloudbuild-sokmil-api.yaml) - Cloud Build configuration
- [crawl-sokmil-api.ts](../scripts/crawlers/crawl-sokmil-api.ts) - Crawler implementation

**Configuration**:
- Image: `gcr.io/adult-v/sokmil-api-crawler:latest`
- Region: `asia-northeast1`
- Timeout: 30 minutes
- Schedule: Daily at 2:30 AM JST
- Default args: `--limit=200 --page=1`

**Environment Variables**:
```bash
DATABASE_URL=postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres
SOKMIL_API_KEY=70c75ce3a36c1f503f2515ff094d6f60
```

## Deployment Instructions

### Initial Deployment

Run the deployment script:

```bash
cd /path/to/adult-v
bash scripts/deploy-api-crawlers.sh
```

This script will:
1. Build and push Docker images to GCR
2. Create Cloud Run Jobs
3. Create Cloud Scheduler jobs

### Manual Deployment Steps

If you prefer manual deployment:

#### 1. Build Images

```bash
# Build DUGA API Crawler
gcloud builds submit --config cloudbuild-duga-api.yaml .

# Build SOKMIL API Crawler
gcloud builds submit --config cloudbuild-sokmil-api.yaml .
```

#### 2. Create Cloud Run Jobs

```bash
# DUGA API Crawler
gcloud run jobs create duga-api-crawler \
  --image=gcr.io/adult-v/duga-api-crawler:latest \
  --region=asia-northeast1 \
  --max-retries=1 \
  --task-timeout=30m \
  --set-env-vars="DATABASE_URL=postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres,DUGA_APP_ID=WzsUOEt2124UD65BqsHU,DUGA_AGENT_ID=48611" \
  --service-account=646431984228-compute@developer.gserviceaccount.com \
  --args="--limit=200,--offset=0"

# SOKMIL API Crawler
gcloud run jobs create sokmil-api-crawler \
  --image=gcr.io/adult-v/sokmil-api-crawler:latest \
  --region=asia-northeast1 \
  --max-retries=1 \
  --task-timeout=30m \
  --set-env-vars="DATABASE_URL=postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres,SOKMIL_API_KEY=70c75ce3a36c1f503f2515ff094d6f60" \
  --service-account=646431984228-compute@developer.gserviceaccount.com \
  --args="--limit=200,--page=1"
```

#### 3. Create Cloud Scheduler Jobs

```bash
# DUGA API Crawler Scheduler
gcloud scheduler jobs create http duga-api-crawler-scheduler \
  --location=asia-northeast1 \
  --schedule="0 2 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/adult-v/jobs/duga-api-crawler:run" \
  --http-method=POST \
  --oauth-service-account-email=646431984228-compute@developer.gserviceaccount.com

# SOKMIL API Crawler Scheduler
gcloud scheduler jobs create http sokmil-api-crawler-scheduler \
  --location=asia-northeast1 \
  --schedule="30 2 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/adult-v/jobs/sokmil-api-crawler:run" \
  --http-method=POST \
  --oauth-service-account-email=646431984228-compute@developer.gserviceaccount.com
```

## Manual Execution

To manually trigger a crawler run:

```bash
# DUGA API Crawler
gcloud run jobs execute duga-api-crawler \
  --region=asia-northeast1 \
  --wait

# SOKMIL API Crawler
gcloud run jobs execute sokmil-api-crawler \
  --region=asia-northeast1 \
  --wait
```

## Monitoring

### View Job Executions

```bash
# List DUGA executions
gcloud run jobs executions list \
  --job=duga-api-crawler \
  --region=asia-northeast1 \
  --limit=10

# List SOKMIL executions
gcloud run jobs executions list \
  --job=sokmil-api-crawler \
  --region=asia-northeast1 \
  --limit=10
```

### View Logs

```bash
# DUGA logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=duga-api-crawler" \
  --limit=50 \
  --format=json

# SOKMIL logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=sokmil-api-crawler" \
  --limit=50 \
  --format=json
```

### Check Scheduler Status

```bash
# List schedulers
gcloud scheduler jobs list --location=asia-northeast1

# Describe DUGA scheduler
gcloud scheduler jobs describe duga-api-crawler-scheduler \
  --location=asia-northeast1

# Describe SOKMIL scheduler
gcloud scheduler jobs describe sokmil-api-crawler-scheduler \
  --location=asia-northeast1
```

## Database Tables

Both crawlers write to the following tables:

### DUGA Tables
- `duga_raw_responses` - Raw JSON from API
- `products` - Normalized product data
- `product_sources` - Source information (asp_name='DUGA')
- `product_images` - Sample images
- `product_raw_data_links` - Link between products and raw data
- `performers` - Performer information
- `categories` - Category/tag information

### SOKMIL Tables
- `sokmil_raw_responses` - Raw JSON from API
- `products` - Normalized product data
- `product_sources` - Source information (asp_name='ソクミル')
- `product_images` - Sample images
- `product_raw_data_links` - Link between products and raw data
- `performers` - Performer information
- `categories` - Genre information

## API Rate Limits

### DUGA
- **Rate Limit**: 60 requests / 60 seconds
- **Crawler Delay**: 1 second between requests
- **Recommended Limit**: 100-200 products per run

### SOKMIL
- **Rate Limit**: Not specified
- **Crawler Delay**: 500ms between requests
- **Recommended Limit**: 100-200 products per run

## Troubleshooting

### Build Failures

If build fails, check:
1. Dockerfile syntax
2. cloudbuild.yaml configuration
3. Source files exist

```bash
# View build logs
gcloud builds list --limit=5
gcloud builds log <BUILD_ID>
```

### Job Execution Failures

If job fails to execute:
1. Check environment variables
2. Verify database connectivity
3. Check API credentials
4. Review logs for errors

```bash
# Get execution details
gcloud run jobs executions describe <EXECUTION_NAME> \
  --region=asia-northeast1
```

### Scheduler Not Triggering

If scheduler doesn't trigger:
1. Verify scheduler is enabled
2. Check schedule syntax
3. Verify service account permissions

```bash
# Pause scheduler
gcloud scheduler jobs pause duga-api-crawler-scheduler \
  --location=asia-northeast1

# Resume scheduler
gcloud scheduler jobs resume duga-api-crawler-scheduler \
  --location=asia-northeast1
```

## Updates and Maintenance

### Update Crawler Code

1. Modify crawler source code
2. Rebuild image:
   ```bash
   gcloud builds submit --config cloudbuild-duga-api.yaml .
   ```
3. Update job (automatic if using latest tag)

### Update Environment Variables

```bash
# Update DUGA job env vars
gcloud run jobs update duga-api-crawler \
  --region=asia-northeast1 \
  --set-env-vars="DATABASE_URL=...,DUGA_APP_ID=...,DUGA_AGENT_ID=..."

# Update SOKMIL job env vars
gcloud run jobs update sokmil-api-crawler \
  --region=asia-northeast1 \
  --set-env-vars="DATABASE_URL=...,SOKMIL_API_KEY=..."
```

### Update Schedule

```bash
# Update DUGA schedule
gcloud scheduler jobs update http duga-api-crawler-scheduler \
  --location=asia-northeast1 \
  --schedule="0 3 * * *"

# Update SOKMIL schedule
gcloud scheduler jobs update http sokmil-api-crawler-scheduler \
  --location=asia-northeast1 \
  --schedule="30 3 * * *"
```

## Cost Estimation

### Cloud Run Jobs
- **vCPU**: 1
- **Memory**: 512Mi
- **Execution time**: ~5-10 minutes per run
- **Cost**: ~$0.01-0.02 per run
- **Monthly cost**: ~$0.60-1.20 (60 runs/month)

### Cloud Scheduler
- **Jobs**: 2
- **Cost**: $0.10/job/month
- **Monthly cost**: $0.20

**Total estimated monthly cost**: ~$0.80-1.40

## Next Steps

- [ ] Monitor first week of automated runs
- [ ] Adjust limits based on API response times
- [ ] Set up alerting for failures
- [ ] Consider pagination for large result sets
- [ ] Implement incremental updates (only new products)

## Related Documentation

- [PERFORMER_IMAGE_CRAWLING_PLAN.md](./PERFORMER_IMAGE_CRAWLING_PLAN.md)
- [CRAWLER_TESTING.md](./CRAWLER_TESTING.md)
- [DUGA API Documentation](https://duga.jp/aff/member/webservice/)
- [SOKMIL API Documentation](https://sokmil-ad.com/member/api)
