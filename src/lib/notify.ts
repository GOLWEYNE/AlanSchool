import { sendPushToUser } from "./push";
import { sendEmailToUser } from "./email";

export type NotifyPayload = {
  title: string;
  body: string;
  url?: string;
};

export const notifyUser = (userId: string, payload: NotifyPayload) => {
  return Promise.allSettled([sendPushToUser(userId, payload), sendEmailToUser(userId, payload)]);
};
