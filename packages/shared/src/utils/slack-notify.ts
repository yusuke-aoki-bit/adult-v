/**
 * Slack通知ユーティリティ
 *
 * クローラーエラーやデータ品質アラートをSlackに通知
 */

interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

interface SlackBlock {
  type: 'section' | 'header' | 'divider' | 'context';
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: 'mrkdwn' | 'plain_text';
    text: string;
  }>;
}

interface SlackAttachment {
  color?: string;
  title?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
}

export interface NotifyOptions {
  /** 通知のタイトル */
  title: string;
  /** メインメッセージ */
  message: string;
  /** 通知レベル: error (赤), warning (黄), success (緑), info (青) */
  level?: 'error' | 'warning' | 'success' | 'info';
  /** 追加フィールド（key-value形式） */
  fields?: Record<string, string | number>;
  /** エラー詳細（スタックトレースなど） */
  errorDetails?: string;
}

const LEVEL_COLORS = {
  error: '#FF0000',
  warning: '#FFA500',
  success: '#00FF00',
  info: '#0000FF',
};

const LEVEL_EMOJIS = {
  error: ':x:',
  warning: ':warning:',
  success: ':white_check_mark:',
  info: ':information_source:',
};

/**
 * Slack Webhookに通知を送信
 */
export async function sendSlackNotification(options: NotifyOptions): Promise<boolean> {
  const webhookUrl = process.env['SLACK_WEBHOOK_URL'];

  if (!webhookUrl) {
    console.log('[slack-notify] SLACK_WEBHOOK_URL not configured, skipping notification');
    return false;
  }

  const level = options.level || 'info';
  const emoji = LEVEL_EMOJIS[level];
  const color = LEVEL_COLORS[level];

  const message: SlackMessage = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${options.title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: options.message,
        },
      },
    ],
    attachments: [],
  };

  // フィールドを追加
  if (options.fields && Object.keys(options.fields).length > 0) {
    const fields = Object.entries(options.fields).map(([key, value]) => ({
      type: 'mrkdwn' as const,
      text: `*${key}:*\n${value}`,
    }));

    message.blocks?.push({
      type: 'section',
      fields,
    });
  }

  // エラー詳細を添付ファイルとして追加
  if (options.errorDetails) {
    message.attachments?.push({
      color,
      title: 'Error Details',
      text: `\`\`\`${options.errorDetails.slice(0, 2000)}\`\`\``,
    });
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
      console.error(`[slack-notify] Failed to send: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log(`[slack-notify] Notification sent: ${options.title}`);
    return true;
  } catch (error) {
    console.error('[slack-notify] Error sending notification:', error);
    return false;
  }
}

/**
 * クローラーエラーを通知
 */
export async function notifyCrawlerError(
  crawlerName: string,
  error: Error | string,
  context?: Record<string, string | number>
): Promise<boolean> {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  return sendSlackNotification({
    title: `Crawler Error: ${crawlerName}`,
    message: `クローラー \`${crawlerName}\` でエラーが発生しました`,
    level: 'error',
    fields: {
      'Error': errorMessage,
      'Timestamp': new Date().toISOString(),
      ...context,
    },
    errorDetails: errorStack,
  });
}

/**
 * データ品質アラートを通知
 */
export async function notifyDataQualityAlert(
  metric: string,
  currentValue: number,
  threshold: number,
  description?: string
): Promise<boolean> {
  return sendSlackNotification({
    title: `Data Quality Alert: ${metric}`,
    message: description || `データ品質指標 \`${metric}\` が閾値を下回りました`,
    level: 'warning',
    fields: {
      'Current Value': `${currentValue.toFixed(2)}%`,
      'Threshold': `${threshold}%`,
      'Difference': `${(threshold - currentValue).toFixed(2)}%`,
      'Timestamp': new Date().toISOString(),
    },
  });
}

/**
 * クローラー完了を通知（オプション: 成功時にも通知したい場合）
 */
export async function notifyCrawlerSuccess(
  crawlerName: string,
  stats: Record<string, string | number>
): Promise<boolean> {
  // 成功通知は環境変数で有効化した場合のみ送信
  if (process.env['SLACK_NOTIFY_SUCCESS'] !== 'true') {
    return false;
  }

  return sendSlackNotification({
    title: `Crawler Completed: ${crawlerName}`,
    message: `クローラー \`${crawlerName}\` が正常に完了しました`,
    level: 'success',
    fields: stats,
  });
}
