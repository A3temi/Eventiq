#!/bin/bash
# Deploy AI Event Organizer Infrastructure to AWS
# Prerequisites: aws configure (credentials set)

set -e

STACK_NAME="eventbot-infrastructure"
REGION="${AWS_REGION:-ap-southeast-1}"
TABLE_PREFIX="${DYNAMODB_TABLE_PREFIX:-eventbot}"

echo "🚀 Deploying AI Event Organizer infrastructure..."
echo "   Region: $REGION"
echo "   Stack: $STACK_NAME"
echo ""

# Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file cloudformation.yaml \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --parameter-overrides \
    Environment=production \
    TablePrefix="$TABLE_PREFIX" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset

echo ""
echo "✅ Infrastructure deployed!"
echo ""

# Get outputs
echo "📋 Stack Outputs:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}" \
  --output table

echo ""
echo "📝 Next steps:"
echo "  1. Verify SES email identity (check your inbox)"
echo "  2. Start WAHA ECS service and scan QR code"
echo "  3. Deploy frontend to Vercel: vercel deploy --prod"
echo "  4. Set up Stripe webhook endpoint in dashboard"
