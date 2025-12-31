import { NextRequest, NextResponse } from 'next/server';
import { getDb, sql } from '@adult-v/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    // 商品IDからproduct_source_idを取得
    const productSourceResult = await db.execute(sql`
      SELECT ps.id as product_source_id, ps.asp_name
      FROM product_sources ps
      JOIN products p ON ps.product_id = p.id
      WHERE p.normalized_id = ${id}
      LIMIT 1
    `);

    if (productSourceResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Product not found',
      }, { status: 404 });
    }

    const productSourceId = productSourceResult.rows[0].product_source_id as number;

    // 過去のセール履歴を取得
    const saleHistoryResult = await db.execute(sql`
      SELECT
        ph.recorded_at,
        ph.price,
        ph.sale_price,
        ph.discount_percent
      FROM price_history ph
      WHERE ph.product_source_id = ${productSourceId}
        AND ph.sale_price IS NOT NULL
        AND ph.discount_percent > 0
      ORDER BY ph.recorded_at DESC
      LIMIT 100
    `);

    const saleHistory = saleHistoryResult.rows;
    const totalHistoricalSales = saleHistory.length;

    // セール履歴がない場合
    if (totalHistoricalSales === 0) {
      return NextResponse.json({
        success: true,
        probability30Days: 0,
        probability90Days: 0,
        typicalDiscountPercent: 0,
        nextLikelySalePeriod: null,
        historicalSaleDates: [],
        averageSaleDurationDays: 0,
        totalHistoricalSales: 0,
      });
    }

    // 平均割引率を計算
    const discountPercents = saleHistory.map(s => Number(s.discount_percent));
    const typicalDiscountPercent = Math.round(
      discountPercents.reduce((a, b) => a + b, 0) / discountPercents.length
    );

    // セール日を月別に集計
    const saleDates = saleHistory.map(s => new Date(s.recorded_at as string));
    const monthCounts: { [key: number]: number } = {};
    saleDates.forEach(date => {
      const month = date.getMonth() + 1;
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });

    // 現在の月と次の3ヶ月のセール確率を計算
    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    // 30日以内のセール確率（現在の月のセール頻度に基づく）
    const currentMonthCount = monthCounts[currentMonth] || 0;
    const probability30Days = Math.min(
      Math.round((currentMonthCount / totalHistoricalSales) * 100 * 3),
      95
    );

    // 90日以内のセール確率（今後3ヶ月のセール頻度に基づく）
    let next3MonthsCount = 0;
    for (let i = 0; i < 3; i++) {
      const month = ((currentMonth + i - 1) % 12) + 1;
      next3MonthsCount += monthCounts[month] || 0;
    }
    const probability90Days = Math.min(
      Math.round((next3MonthsCount / totalHistoricalSales) * 100),
      95
    );

    // 次回セール予想期間
    let nextLikelySalePeriod: string | null = null;
    const peakMonth = Object.entries(monthCounts)
      .sort(([, a], [, b]) => b - a)[0];
    if (peakMonth) {
      const monthNum = parseInt(peakMonth[0]);
      const monthNames = {
        ja: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      };
      if (monthNum > currentMonth || (monthNum === currentMonth && probability30Days >= 30)) {
        nextLikelySalePeriod = monthNames.ja[monthNum - 1];
      } else {
        // 来年の同じ月
        nextLikelySalePeriod = `来年${monthNames.ja[monthNum - 1]}頃`;
      }
    }

    // セール期間の平均日数（連続するセール日を1つのセールとしてカウント）
    const sortedDates = saleDates.sort((a, b) => a.getTime() - b.getTime());
    let totalDuration = 0;
    let saleCount = 0;
    let currentSaleStart = sortedDates[0];
    let lastDate = sortedDates[0];

    for (let i = 1; i < sortedDates.length; i++) {
      const diff = (sortedDates[i].getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diff > 7) {
        // 新しいセール期間
        totalDuration += (lastDate.getTime() - currentSaleStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
        saleCount++;
        currentSaleStart = sortedDates[i];
      }
      lastDate = sortedDates[i];
    }
    // 最後のセール期間を追加
    totalDuration += (lastDate.getTime() - currentSaleStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
    saleCount++;

    const averageSaleDurationDays = Math.round(totalDuration / saleCount);

    // 過去のセール日（ユニークな日付）
    const historicalSaleDates = [...new Set(
      saleDates.map(d => d.toISOString().split('T')[0])
    )].slice(0, 10);

    return NextResponse.json({
      success: true,
      probability30Days,
      probability90Days,
      typicalDiscountPercent,
      nextLikelySalePeriod,
      historicalSaleDates,
      averageSaleDurationDays,
      totalHistoricalSales,
    });
  } catch (error) {
    console.error('Failed to calculate sale prediction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate sale prediction' },
      { status: 500 }
    );
  }
}
