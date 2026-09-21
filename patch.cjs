const fs = require('fs');
const content = fs.readFileSync('src/components/Modals/DiaryModal.tsx', 'utf8');
const search = `            ) : (
              filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  id={\`diary-card-\${entry.id}\`}
                  className="p-3.5 glass-card rounded-xl relative group transition-all"
                >
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5 ml-[11px]">
                    <span className="text-slate-100 flex items-center gap-1.5">
                      <span className="text-[15px]">{entry.title}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-hud font-bold px-1.5 py-0.5 rounded text-[11px] text-sky-400 bg-sky-950/40 border border-sky-500/30">
                        {entry.date}
                      </span>
                      <div className="flex items-center">
                        <button
                          id={\`btn-edit-diary-\${entry.id}\`}
                          onClick={() => handleStartEdit(entry)}
                          className="w-5 h-5 mr-[17px] rounded hover:bg-sky-500/20 text-slate-400 hover:text-sky-300 flex items-center justify-center transition"
                          title="修改"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {onDeleteEntry && (
                          <button
                            id={\`btn-delete-diary-\${entry.id}\`}
                            onClick={() => handleDeleteClick(entry.id)}
                            className="w-5 h-5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition"
                            title="刪除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {entry.summary && (
                    <div className="text-xs text-sky-300/90 font-semibold mb-1.5 ml-3">
                      {entry.summary}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line line-clamp-2 ml-3 mr-[21px] mb-1.5">
                    {entry.content}
                  </p>
                  {/* Keyword Tags List on Card */}
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 ml-[9px] mr-[21px]">
                      {entry.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => {
                            sound.playClick();
                            setSelectedTag(selectedTag === tag ? null : tag);
                          }}
                          className={\`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-sans font-medium transition cursor-pointer \${
                            selectedTag === tag
                              ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                              : 'bg-sky-950/40 hover:bg-sky-900/60 text-sky-300 border border-sky-400/20'
                          }\`}
                          title={\`點擊篩選 #\${tag}\`}
                        >
                          <Tag className="w-2.5 h-2.5" />
                          <span>#{tag}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}`;
const replace = fs.readFileSync('test-edit.ts', 'utf8');

if(content.includes(search)) {
    fs.writeFileSync('src/components/Modals/DiaryModal.tsx', content.replace(search, replace));
    console.log("Replaced successfully");
} else {
    console.log("Could not find search string");
}
