export interface ApplyPageSpoofMessage {
  type: 'APPLY_PAGE_SPOOF';
  language: string;
  timezone: string;
}

export type ExtensionMessage = ApplyPageSpoofMessage;

export function isApplyPageSpoofMessage(
  message: unknown
): message is ApplyPageSpoofMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'APPLY_PAGE_SPOOF' &&
    'language' in message &&
    typeof message.language === 'string' &&
    'timezone' in message &&
    typeof message.timezone === 'string'
  );
}
