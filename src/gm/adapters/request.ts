/**
 * 送給任一供應商的通用 JSON 請求。
 *
 * 轉接器只負責「把這份請求翻成該供應商的格式、送出、取回 JSON」，
 * 不認識 GM 或助理的任何業務內容 —— prompt 與輸出格式由呼叫端決定。
 * 這樣 GM、快速回覆、日記生成才能共用同一套連線與錯誤處理。
 */
export interface JsonRequest {
  system: string;
  /** 依序的對話訊息。assistant 在 Gemini 會轉成 model。 */
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /**
   * 輸出的 JSON 結構（OpenAPI schema 子集）。
   * Gemini 會強制套用；不支援 schema 的供應商（DeepSeek）則只靠 prompt 引導，
   * 所以呼叫端取回資料後一律要自行驗證，不能信任形狀。
   */
  schema: object;
  /** json_schema 模式要求的名稱。 */
  schemaName: string;
}
