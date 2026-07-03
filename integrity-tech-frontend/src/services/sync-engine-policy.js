export function shouldRemoveQueuedAnswerAfterResponse(status) {
  return status >= 200 && status < 300;
}
