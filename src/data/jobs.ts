export interface JobResourceDefinition {
  id: string;
  name: string;
  initial: number;
  max?: number;
}

export interface JobDefinition {
  id: string;
  name: string;
  description: string;
  resources: JobResourceDefinition[];
}

// 当前只开放一个职业，数据结构为后续增加职业和多种职业资源预留空间。
export const JOB_DEFINITIONS: JobDefinition[] = [
  {
    id: 'dragoon',
    name: '龙骑士',
    description: '以近战攻击为主的高机动职业。',
    resources: [
      { id: 'dragon-gauge', name: '龙血', initial: 0, max: 3 },
    ],
  },
];

export type JobId = (typeof JOB_DEFINITIONS)[number]['id'];

export function getJobDefinition(jobId: string): JobDefinition | undefined {
  return JOB_DEFINITIONS.find((job) => job.id === jobId);
}

