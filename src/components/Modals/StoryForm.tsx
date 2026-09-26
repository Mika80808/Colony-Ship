import React from 'react';

export type FieldKind = 'text' | 'textarea' | 'select' | 'number';

/** 下拉選項。純字串時值與顯示文字相同。 */
export type FieldOption = string | { value: string; label: string };

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  /** kind === 'select' 時的選項。 */
  options?: FieldOption[];
  /** half = 與下一欄並排，full = 獨佔一行。 */
  span?: 'half' | 'full';
  rows?: number;
  autoFocus?: boolean;
}

/** 四個分頁共用的表單值。欄位由 schema 決定，值一律以字串保存。 */
export type FormValues = Record<string, string>;

interface StoryFormProps {
  compact?: boolean;
  fields: FieldDef[];
  values: FormValues;
  onChange: (key: string, value: string) => void;
  /** 儲存校驗失敗的欄位，以欄位 key 對應錯誤訊息。 */
  errors?: Record<string, string>;
}

const optionValue = (opt: FieldOption) => (typeof opt === 'string' ? opt : opt.value);
const optionLabel = (opt: FieldOption) => (typeof opt === 'string' ? opt : opt.label);

/**
 * 故事書四個分頁共用的表單。
 * 欄位長相由 fields schema 描述，元件本身不知道自己在編角色還是地點。
 */
export default function StoryForm({ fields, values, onChange, errors = {}, compact = false }: StoryFormProps) {
  // 連續的 half 欄位兩兩併成一列，其餘各自獨佔一行。
  const rows: FieldDef[][] = [];
  for (const field of fields) {
    const last = rows[rows.length - 1];
    if (field.span === 'half' && last?.length === 1 && last[0].span === 'half') {
      last.push(field);
    } else {
      rows.push([field]);
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-2.5"}>
      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className={row.length > 1 ? 'grid grid-cols-2 gap-2.5' : undefined}
        >
          {row.map((field) => {
            const error = errors[field.key];
            const invalid = error ? ' !border-rose-500/70' : '';
            return (
              <div key={field.key}>
                <label className="text-[12px] text-slate-400 block mb-1">
                  {field.label}
                </label>

                {field.kind === 'select' ? (
                  <select
                    value={values[field.key] ?? ''}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    aria-invalid={!!error}
                    className={`w-full h-8 glass-input rounded-lg px-2.5 text-xs text-slate-100 focus:outline-none bg-[#0a1226]${invalid}`}
                  >
                    {(field.options ?? []).map((opt) => (
                      <option key={optionValue(opt)} value={optionValue(opt)}>
                        {optionLabel(opt)}
                      </option>
                    ))}
                  </select>
                ) : field.kind === 'textarea' ? (
                  <textarea
                    value={values[field.key] ?? ''}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={field.rows ?? 2}
                    autoFocus={field.autoFocus}
                    aria-invalid={!!error}
                    className={`w-full glass-input rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none resize-y ${compact ? "min-h-[52px]" : "min-h-[60px]"} max-h-[200px]${invalid}`}
                  />
                ) : (
                  <input
                    type={field.kind === 'number' ? 'number' : 'text'}
                    value={values[field.key] ?? ''}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    autoFocus={field.autoFocus}
                    aria-invalid={!!error}
                    className={`w-full h-8 glass-input rounded-lg px-2.5 text-xs text-slate-100 focus:outline-none${invalid}`}
                  />
                )}

                {error && <div className="mt-1 text-[12px] text-rose-300">{error}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
