import React, { useState, useRef } from 'react';
import {
    Folder, FolderOpen, FileCode, FileText, FileJson, File as FileIcon,
    ChevronRight, ChevronDown, Plus, FolderPlus, Pencil, Trash2, X,
} from 'lucide-react';

/* ── icon mapping by extension ── */
function getFileIcon(name) {
    if (!name) return <FileIcon size={14} className="text-slate-500" />;
    const ext = name.split('.').pop()?.toLowerCase();
    const iconMap = {
        js: <FileCode size={14} className="text-yellow-400" />,
        jsx: <FileCode size={14} className="text-cyan-400" />,
        ts: <FileCode size={14} className="text-blue-400" />,
        tsx: <FileCode size={14} className="text-blue-300" />,
        py: <FileCode size={14} className="text-green-400" />,
        html: <FileCode size={14} className="text-orange-400" />,
        css: <FileCode size={14} className="text-purple-400" />,
        scss: <FileCode size={14} className="text-pink-400" />,
        json: <FileJson size={14} className="text-yellow-300" />,
        md: <FileText size={14} className="text-slate-300" />,
        sql: <FileCode size={14} className="text-emerald-400" />,
        java: <FileCode size={14} className="text-red-400" />,
        go: <FileCode size={14} className="text-cyan-300" />,
        rs: <FileCode size={14} className="text-orange-300" />,
    };
    return iconMap[ext] || <FileIcon size={14} className="text-slate-500" />;
}

/* ── single tree node ── */
function TreeNode({
    node, depth, currentFileId, onSelectFile,
    onCreateFile, onCreateFolder, onRename, onDelete,
}) {
    const [expanded, setExpanded] = useState(depth < 1);
    const [contextMenu, setContextMenu] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(node.name || '');
    const menuRef = useRef(null);

    const isFolder = node.type === 'folder';
    const isActive = node.id === currentFileId;

    const handleClick = () => {
        if (isFolder) {
            setExpanded(prev => !prev);
        } else {
            onSelectFile?.(node.id);
        }
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu(prev => !prev);
    };

    const handleRenameSubmit = () => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== node.name) {
            onRename?.(node.id, trimmed);
        }
        setRenaming(false);
        setContextMenu(false);
    };

    return (
        <div>
            <div
                className={`flex items-center gap-1 px-2 py-[3px] rounded cursor-pointer text-[12px] group relative select-none ${isActive
                    ? 'bg-brand-500/20 text-white'
                    : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
            >
                {/* expand / collapse icon */}
                {isFolder ? (
                    expanded ? <ChevronDown size={12} className="text-slate-500 shrink-0" /> : <ChevronRight size={12} className="text-slate-500 shrink-0" />
                ) : (
                    <span className="w-3 shrink-0" />
                )}

                {/* file / folder icon */}
                {isFolder ? (
                    expanded
                        ? <FolderOpen size={14} className="text-brand-400 shrink-0" />
                        : <Folder size={14} className="text-brand-400 shrink-0" />
                ) : (
                    getFileIcon(node.name)
                )}

                {/* name */}
                {renaming ? (
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleRenameSubmit(); }}
                        className="flex items-center gap-1 flex-1"
                        onClick={e => e.stopPropagation()}
                    >
                        <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            className="flex-1 bg-slate-900 border border-brand-500/40 rounded px-1 py-0 text-[11px] text-white outline-none"
                            onBlur={handleRenameSubmit}
                            onKeyDown={e => { if (e.key === 'Escape') { setRenaming(false); setContextMenu(false); } }}
                        />
                    </form>
                ) : (
                    <span className="truncate flex-1">{node.name}</span>
                )}

                {/* action dots on hover */}
                {!renaming && (
                    <button
                        onClick={handleContextMenu}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-opacity shrink-0 p-0.5"
                    >
                        <span className="text-[10px]">•••</span>
                    </button>
                )}
            </div>

            {/* context menu */}
            {contextMenu && !renaming && (
                <div
                    ref={menuRef}
                    className="ml-6 mb-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-[11px] overflow-hidden z-50"
                    style={{ marginLeft: `${depth * 12 + 20}px` }}
                >
                    {isFolder && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); onCreateFile?.(node.id); setContextMenu(false); }}
                                className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-slate-800 text-slate-300 text-left"
                            >
                                <Plus size={12} /> New File
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onCreateFolder?.(node.id); setContextMenu(false); }}
                                className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-slate-800 text-slate-300 text-left"
                            >
                                <FolderPlus size={12} /> New Folder
                            </button>
                        </>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); setRenaming(true); setRenameValue(node.name || ''); }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-slate-800 text-slate-300 text-left"
                    >
                        <Pencil size={12} /> Rename
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete?.(node.id); setContextMenu(false); }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-red-500/10 text-red-400 text-left"
                    >
                        <Trash2 size={12} /> Delete
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setContextMenu(false); }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-slate-800 text-slate-500 text-left border-t border-slate-800"
                    >
                        <X size={12} /> Close
                    </button>
                </div>
            )}

            {/* children */}
            {isFolder && expanded && node.children && (
                <div>
                    {node.children.map(child => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            currentFileId={currentFileId}
                            onSelectFile={onSelectFile}
                            onCreateFile={onCreateFile}
                            onCreateFolder={onCreateFolder}
                            onRename={onRename}
                            onDelete={onDelete}
                        />
                    ))}
                    {node.children.length === 0 && (
                        <div
                            className="text-[10px] text-slate-600 italic px-2 py-0.5"
                            style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
                        >
                            Empty folder
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ── main FileTree ── */
export default function FileTree({
    tree, currentFileId, onSelectFile,
    onCreateFile, onCreateFolder, onRename, onDelete,
}) {
    const items = tree ?? [];

    return (
        <div className="flex h-full flex-col rounded-lg border border-slate-800 bg-slate-950/80 text-xs">
            <div className="border-b border-slate-800 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-300 flex items-center justify-between">
                <span>Explorer</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onCreateFile?.(null)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
                        title="New File"
                    >
                        <Plus size={13} />
                    </button>
                    <button
                        onClick={() => onCreateFolder?.(null)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
                        title="New Folder"
                    >
                        <FolderPlus size={13} />
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1 text-[11px] text-slate-300 custom-scrollbar">
                {items.length === 0 ? (
                    <div className="px-2 py-3 text-slate-500 text-center">No files yet. Create one above.</div>
                ) : (
                    items.map(node => (
                        <TreeNode
                            key={node.id}
                            node={node}
                            depth={0}
                            currentFileId={currentFileId}
                            onSelectFile={onSelectFile}
                            onCreateFile={onCreateFile}
                            onCreateFolder={onCreateFolder}
                            onRename={onRename}
                            onDelete={onDelete}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
