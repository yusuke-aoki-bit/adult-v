import { NextRequest, NextResponse } from 'next/server';
import { getDb, sql } from '@adult-v/database';

export const revalidate = 1800; // 30分キャッシュ

interface SaleEvent {
  date: string;
  productCount: number;
  avgDiscount: number;
  topCategories: string[];
}

interface MonthStats {
  month: number;
  avgSaleProducts: number;
  avgDiscount: number;
  saleFrequency: number;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);

    // 指定年のセールイベントを日付別に集計
    const saleEventsResult = await db.execute(sql`
      SELECT
        DATE(ph.recorded_at) as sale_date,
        COUNT(DISTINCT ps.product_id) as product_count,
        ROUND(AVG(ph.discount_percent), 0) as avg_discount
      FROM price_history ph
      JOIN product_sources ps ON ph.product_source_id = ps.id
      WHERE ph.sale_price IS NOT NULL
        AND ph.discount_percent > 0
        AND EXTRACT(YEAR FROM ph.recorded_at) = ${year}
      GROUP BY DATE(ph.recorded_at)
      ORDER BY sale_date
    `);

    // 月別統計
    const monthStatsResult = await db.execute(sql`
      SELECT
        EXTRACT(MONTH FROM ph.recorded_at)::integer as month,
        COUNT(DISTINCT ps.product_id)::integer as total_products,
        ROUND(AVG(ph.discount_percent), 0)::integer as avg_discount,
        COUNT(DISTINCT DATE(ph.recorded_at))::integer as sale_days
      FROM price_history ph
      JOIN product_sources ps ON ph.product_source_id = ps.id
      WHERE ph.sale_price IS NOT NULL
        AND ph.discount_percent > 0
        AND EXTRACT(YEAR FROM ph.recorded_at) = ${year}
      GROUP BY EXTRACT(MONTH FROM ph.recorded_at)
      ORDER BY month
    `);

    // 予測セール期間（過去のデータから高頻度のセール時期を特定）
    const predictedSalesResult = await db.execute(sql`
      SELECT
        EXTRACT(MONTH FROM ph.recorded_at)::integer as month,
        EXTRACT(DAY FROM ph.recorded_at)::integer as day,
        COUNT(*)::integer as frequency
      FROM price_history ph
      WHERE ph.sale_price IS NOT NULL
        AND ph.discount_percent >= 30
      GROUP BY EXTRACT(MONTH FROM ph.recorded_at), EXTRACT(DAY FROM ph.recorded_at)
      HAVING COUNT(*) >= 5
      ORDER BY frequency DESC
      LIMIT 20
    `);

    // セールイベントを整形
    const saleEvents: SaleEvent[] = saleEventsResult.rows.map(row => {
      // sale_dateはDATEの結果で文字列またはDateオブジェクト
      const saleDate = row['sale_date'];
      const dateStr = saleDate instanceof Date
        ? saleDate.toISOString().split('T')[0]
        : String(saleDate);
      return {
        date: dateStr,
        productCount: Number(row['product_count']),
        avgDiscount: Number(row['avg_discount']),
        topCategories: [],
      };
    });

    // 月別統計を整形
    const monthStats: MonthStats[] = monthStatsResult.rows.map(row => ({
      month: Number(row['month']),
      avgSaleProducts: Math.round(Number(row['total_products']) / Math.max(Number(row['sale_days']), 1)),
      avgDiscount: Number(row['avg_discount']),
      saleFrequency: Number(row['sale_days']),
    }));

    // 予測されるセール日
    const predictedSales = predictedSalesResult.rows.map(row => ({
      month: Number(row['month']),
      day: Number(row['day']),
      frequency: Number(row['frequency']),
    }));

    // 次の大型セール予測
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const nextBigSale = predictedSales.find(s =>
      s.month > currentMonth || (s.month === currentMonth && s.day > now.getDate())
    ) || predictedSales[0];

    return NextResponse.json({
      success: true,
      year,
      saleEvents,
      monthStats,
      predictedSales,
      nextBigSale,
      summary: {
        totalSaleDays: saleEvents.length,
        avgMonthlyDiscount: monthStats.length > 0
          ? Math.round(monthStats.reduce((a, b) => a + b.avgDiscount, 0) / monthStats.length)
          : 0,
        peakMonth: monthStats.reduce((max, curr) =>
          curr.saleFrequency > (max?.saleFrequency || 0) ? curr : max, monthStats[0]
        )?.month || null,
      },
    });
  } catch (error) {
    console.error('Failed to fetch sale calendar:', error);
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);
    return NextResponse.json({
      success: false,
      fallback: true,
      year,
      saleEvents: [],
      monthStats: [],
      predictedSales: [],
      nextBigSale: null,
      summary: {
        totalSaleDays: 0,
        avgMonthlyDiscount: 0,
        peakMonth: null,
      },
    });
  }
}
