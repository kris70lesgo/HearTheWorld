import { NextResponse } from "next/server";

const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";
const ONESIGNAL_APP_ID =
  process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "67b7ec41-d3ba-46c5-8587-a16eb62317ef";

type NotificationRequest = {
  subscriptionId?: string;
  title?: string;
  message?: string;
  url?: string;
  tag?: string;
  priority?: "high" | "medium" | "low";
};

type OneSignalResponse = {
  id?: string;
  recipients?: number;
  successful?: number;
  failed?: number;
  errors?: unknown;
};

async function getNotificationDeliveryStatus(
  notificationId: string,
  restApiKey: string,
): Promise<OneSignalResponse | null> {
  const statusUrl = `${ONESIGNAL_API_URL}/${notificationId}?app_id=${ONESIGNAL_APP_ID}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 750));
    }

    const response = await fetch(statusUrl, {
      headers: {
        Authorization: `Key ${restApiKey}`,
      },
    });
    if (!response.ok) {
      continue;
    }

    const body = (await response.json().catch(() => null)) as OneSignalResponse | null;
    if (body?.successful !== undefined || body?.failed !== undefined) {
      return body;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!restApiKey) {
    return NextResponse.json(
      {
        error:
          "ONESIGNAL_REST_API_KEY is missing. Add it to frontend/.env.local to send OneSignal pushes.",
      },
      { status: 503 },
    );
  }

  const payload = (await request.json().catch(() => null)) as NotificationRequest | null;
  if (!payload?.subscriptionId || !payload.title || !payload.message) {
    return NextResponse.json(
      { error: "subscriptionId, title, and message are required." },
      { status: 400 },
    );
  }

  const response = await fetch(ONESIGNAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${restApiKey}`,
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      target_channel: "push",
      include_subscription_ids: [payload.subscriptionId],
      headings: { en: payload.title },
      contents: { en: payload.message },
      url: payload.url,
      web_push_topic: payload.tag,
      isAnyWeb: true,
      ttl: 300,
      priority: payload.priority === "high" ? 10 : 5,
    }),
  });

  const body = (await response.json().catch(() => null)) as OneSignalResponse | null;
  console.info("OneSignal notification response", {
    status: response.status,
    id: body?.id,
    recipients: body?.recipients,
    errors: body?.errors,
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "OneSignal rejected the notification request.", details: body },
      { status: response.status },
    );
  }

  const deliveryStatus = body?.id
    ? await getNotificationDeliveryStatus(body.id, restApiKey)
    : null;
  const deliveredCount = deliveryStatus?.successful ?? body?.successful ?? body?.recipients;
  const failedCount = deliveryStatus?.failed ?? body?.failed;

  console.info("OneSignal delivery status", {
    id: body?.id,
    successful: deliveredCount,
    failed: failedCount,
    errors: deliveryStatus?.errors,
  });

  if (deliveredCount === 0) {
    return NextResponse.json(
      {
        error:
          "OneSignal accepted the request but targeted 0 subscribed browser devices.",
        details: deliveryStatus ?? body,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: body?.id,
    recipients: deliveredCount,
    failed: failedCount,
    result: body,
    deliveryStatus,
  });
}
