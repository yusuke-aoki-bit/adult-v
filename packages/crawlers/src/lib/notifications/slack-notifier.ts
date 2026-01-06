/**
 * Slack通知モジュール
 *
 * クローラー実行結果をSlackに通知
 */

export interface CrawlerSummary {
  name: string;
  success: boolean;
  duration: number;
  itemsProcessed?: number;
  itemsSucceeded?: number;
  itemsFailed?: number;
  error?: string;
}

export interface CrawlPipelineSummary {
  pipelineName: string;
  startTime: Date;
  endTime: Date;
  crawlers: CrawlerSummary[];
}

interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: Array<{
    type: string;
    text: string;
  }>;
}

/**
 * Slack Webhook URLを取得
 */
function getSlackWebhookUrl(): string | null {
  return process.env['SLACK_CRAWLER_WEBHOOK_URL'] || null;
}

/**
 * Slackに通知を送信
 */
async function sendSlackMessage(message: SlackMessage): Promise<boolean> {
  const webhookUrl = getSlackWebhookUrl();

  if (!webhookUrl) {
    console.log('[SlackNotifier] No webhook URL configured, skipping notification');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('[SlackNotifier] Failed to send message:', response['status']);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SlackNotifier] Error sending message:', error);
    return false;
  }
}

/**
 * クローラーパイプライン完了通知
 */
export async function notifyPipelineComplete(summary: CrawlPipelineSummary): Promise<boolean> {
  const successCount = summary.crawlers.filter(c => c.success).length;
  const failureCount = summary.crawlers.filter(c => !c.success).length;
  const totalDuration = Math.round((summary.endTime.getTime() - summary.startTime.getTime()) / 1000);

  const isSuccess = failureCount === 0;
  const emoji = isSuccess ? '✅' : '⚠️';
  const status = isSuccess ? 'Completed' : 'Completed with errors';

  // サマリーテキスト
  const summaryText = `${emoji} ${summary.pipelineName}: ${status} (${successCount}/${summary.crawlers.length} succeeded)`;

  // 詳細ブロック
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: summaryText,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Duration:* ${formatDuration(totalDuration)}\n*Time:* ${summary.startTime.toISOString()}`,
      },
    },
    {
      type: 'divider',
    } as SlackBlock,
  ];

  // 成功したクローラー
  if (successCount > 0) {
    const successList = summary.crawlers
      .filter(c => c.success)
      .map(c => {
        const items = c.itemsProcessed ? ` (${c.itemsSucceeded}/${c.itemsProcessed} items)` : '';
        return `✅ ${c.name}: ${formatDuration(Math.round(c.duration / 1000))}${items}`;
      })
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Succeeded:*\n${successList}`,
      },
    });
  }

  // 失敗したクローラー
  if (failureCount > 0) {
    const failureList = summary.crawlers
      .filter(c => !c.success)
      .map(c => `❌ ${c.name}: ${c.error?.slice(0, 100) || 'Unknown error'}`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Failed:*\n${failureList}`,
      },
    });
  }

  return sendSlackMessage({
    text: summaryText,
    blocks,
  });
}

/**
 * 単一クローラー失敗通知（エラー率閾値超過時）
 */
export async function notifyCrawlerError(
  crawlerName: string,
  error: string,
  context?: Record<string, unknown>
): Promise<boolean> {
  const contextStr = context
    ? Object.entries(context)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    : '';

  const message: SlackMessage = {
    text: `❌ Crawler Error: ${crawlerName}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `❌ Crawler Error: ${crawlerName}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:*\n\`\`\`${error.slice(0, 500)}\`\`\``,
        },
      },
    ],
  };

  if (contextStr) {
    message.blocks!.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Context:*\n${contextStr}`,
      },
    });
  }

  return sendSlackMessage(message);
}

/**
 * エラー率閾値超過通知
 */
export async function notifyHighErrorRate(
  crawlerName: string,
  errorRate: number,
  threshold: number,
  totalItems: number,
  failedItems: number
): Promise<boolean> {
  return sendSlackMessage({
    text: `⚠️ High Error Rate: ${crawlerName} (${Math.round(errorRate * 100)}%)`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `⚠️ High Error Rate Alert`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `*Crawler:* ${crawlerName}`,
            `*Error Rate:* ${Math.round(errorRate * 100)}% (threshold: ${Math.round(threshold * 100)}%)`,
            `*Items:* ${failedItems}/${totalItems} failed`,
          ].join('\n'),
        },
      },
    ],
  });
}

/**
 * 秒を読みやすい形式に変換
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
