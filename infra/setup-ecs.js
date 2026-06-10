const { IAMClient, CreateRoleCommand, AttachRolePolicyCommand, GetRoleCommand } = require('@aws-sdk/client-iam');
const { ECSClient, RegisterTaskDefinitionCommand, CreateServiceCommand, DescribeServicesCommand } = require('@aws-sdk/client-ecs');
const { EC2Client, DescribeVpcsCommand, DescribeSubnetsCommand, CreateSecurityGroupCommand, AuthorizeSecurityGroupIngressCommand, DescribeSecurityGroupsCommand } = require('@aws-sdk/client-ec2');

const region = 'us-east-1';
const iam = new IAMClient({ region });
const ecs = new ECSClient({ region });
const ec2 = new EC2Client({ region });

async function ensureExecutionRole() {
  try {
    await iam.send(new GetRoleCommand({ RoleName: 'ecsTaskExecutionRole' }));
    console.log('✓ ecsTaskExecutionRole exists');
  } catch (e) {
    if (e.name === 'NoSuchEntityException') {
      await iam.send(new CreateRoleCommand({
        RoleName: 'ecsTaskExecutionRole',
        AssumeRolePolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Principal: { Service: 'ecs-tasks.amazonaws.com' },
            Action: 'sts:AssumeRole',
          }],
        }),
      }));
      await iam.send(new AttachRolePolicyCommand({
        RoleName: 'ecsTaskExecutionRole',
        PolicyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
      }));
      console.log('✓ ecsTaskExecutionRole created');
    } else {
      throw e;
    }
  }
}

async function getDefaultVpcSubnets() {
  const vpcs = await ec2.send(new DescribeVpcsCommand({ Filters: [{ Name: 'isDefault', Values: ['true'] }] }));
  const vpcId = vpcs.Vpcs[0]?.VpcId;
  if (!vpcId) throw new Error('No default VPC found');

  const subnets = await ec2.send(new DescribeSubnetsCommand({ Filters: [{ Name: 'vpc-id', Values: [vpcId] }] }));
  return { vpcId, subnetIds: subnets.Subnets.map(s => s.SubnetId) };
}

async function ensureSecurityGroup(vpcId) {
  const groupName = 'eventbot-waha-sg';
  try {
    const existing = await ec2.send(new DescribeSecurityGroupsCommand({
      Filters: [{ Name: 'group-name', Values: [groupName] }, { Name: 'vpc-id', Values: [vpcId] }],
    }));
    if (existing.SecurityGroups.length > 0) {
      console.log(`✓ Security group ${groupName} exists`);
      return existing.SecurityGroups[0].GroupId;
    }
  } catch (e) {}

  const sg = await ec2.send(new CreateSecurityGroupCommand({
    GroupName: groupName,
    Description: 'WAHA WhatsApp service',
    VpcId: vpcId,
  }));

  await ec2.send(new AuthorizeSecurityGroupIngressCommand({
    GroupId: sg.GroupId,
    IpPermissions: [
      { IpProtocol: 'tcp', FromPort: 3000, ToPort: 3000, IpRanges: [{ CidrIp: '0.0.0.0/0' }] },
    ],
  }));

  console.log(`✓ Security group ${groupName} created`);
  return sg.GroupId;
}

async function registerWahaTask() {
  try {
    await ecs.send(new RegisterTaskDefinitionCommand({
      family: 'eventbot-waha',
      cpu: '512',
      memory: '1024',
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      executionRoleArn: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID || '000000000000'}:role/ecsTaskExecutionRole`,
      containerDefinitions: [{
        name: 'waha',
        image: 'devlikeapro/waha:latest',
        portMappings: [{ containerPort: 3000, protocol: 'tcp' }],
        environment: [
          { name: 'WHATSAPP_DEFAULT_ENGINE', value: 'WEBJS' },
          { name: 'WAHA_DASHBOARD_ENABLED', value: 'true' },
        ],
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-group': '/ecs/eventbot-waha',
            'awslogs-region': region,
            'awslogs-stream-prefix': 'waha',
            'awslogs-create-group': 'true',
          },
        },
      }],
    }));
    console.log('✓ WAHA task definition registered');
  } catch (e) {
    console.error(`✗ WAHA task definition: ${e.message}`);
  }
}

async function createWahaService(subnetIds, sgId) {
  try {
    const existing = await ecs.send(new DescribeServicesCommand({
      cluster: 'eventbot-services',
      services: ['eventbot-waha'],
    }));
    if (existing.services?.some(s => s.status === 'ACTIVE')) {
      console.log('✓ WAHA service already running');
      return;
    }
  } catch (e) {}

  try {
    await ecs.send(new CreateServiceCommand({
      cluster: 'eventbot-services',
      serviceName: 'eventbot-waha',
      taskDefinition: 'eventbot-waha',
      desiredCount: 1,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: subnetIds.slice(0, 2),
          securityGroups: [sgId],
          assignPublicIp: 'ENABLED',
        },
      },
    }));
    console.log('✓ WAHA Fargate service created (starting...)');
  } catch (e) {
    console.error(`✗ WAHA service: ${e.message}`);
  }
}

async function main() {
  console.log('Setting up ECS services...\n');

  await ensureExecutionRole();
  const { vpcId, subnetIds } = await getDefaultVpcSubnets();
  console.log(`  VPC: ${vpcId}, Subnets: ${subnetIds.length}`);

  const sgId = await ensureSecurityGroup(vpcId);
  await registerWahaTask();
  await createWahaService(subnetIds, sgId);

  console.log('\n✅ ECS setup complete!');
  console.log('WAHA will be accessible at the public IP of the Fargate task on port 3000.');
  console.log('Check: aws ecs list-tasks --cluster eventbot-services --region us-east-1');
}

main().catch(console.error);
