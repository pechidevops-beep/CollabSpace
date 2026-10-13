import React, { useState, useRef } from 'react';
import {
    Folder, FolderOpen, FileCode, FileText, FileJson, File as FileIcon,
    ChevronRight, ChevronDown, Plus, FolderPlus, Pencil, Trash2, X,
} from 'lucide-react';

/* ── icon mapping by extension ── */
function getFileIcon(name) {
    if (!name) return <FileIcon size={14} className="text-text-dim" />;
    const ext = name.split('.').pop()?.toLowerCase();
    const iconMap = {
        js: <FileCode size={14} className="text-yellow-400" />,
        jsx: <FileCode size={14} className="text-cyan-400" />,
        ts: <FileCode size={14} className="text-blue-400" />,
        tsx: <FileCode size={14} className="text-blue-300" />,
        py: <FileCode size={14} className="text-emerald-400" />,
        html: <FileCode size={14} className="text-orange-400" />,
        css: <FileCode size={14} className="text-accent" />,
        scss: <FileCode size={14} className="text-pink-400" />,
        json: <FileJson size={14} className="text-yellow-300" />,
        md: <FileText size={14} className="text-text-sub" />,
        sql: <FileCode size={14} className="text-emerald-400" />,
        java: <FileCode size={14} className="text-red-400" />,
        go: <FileCode size={14} className="text-cyan-300" />,
        rs: <FileCode size={14} className="text-orange-300" />,
    };
    return iconMap[ext] || <FileIcon size={14} className="text-text-dim" />;
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
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer text-xs group relative select-none transition-colors ${isActive
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-text-sub hover:bg-subtle hover:text-text-main'
                    }`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
            >
                {/* expand / collapse icon */}
                {isFolder ? (
                    expanded ? <ChevronDown size={12} className="text-text-dim shrink-0" /> : <ChevronRight size={12} className="text-text-dim shrink-0" />
                ) : (
                    <span className="w-3 shrink-0" />
                )}

                {/* file / folder icon */}
                {isFolder ? (
                    expanded
                        ? <FolderOpen size={14} className="text-accent shrink-0" />
                        : <Folder size={14} className="text-accent shrink-0" />
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
                            className="flex-1 bg-surface border border-accent rounded px-1.5 py-0.5 text-xs text-text-main outline-none"
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
                        className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-text-main transition-opacity shrink-0 p-0.5"
                    >
                        <span className="text-[10px]">•••</span>
                    </button>
                )}
            </div>

            {/* context menu */}
            {contextMenu && !renaming && (
                <div
                    ref={menuRef}
                    className="ml-6 mb-1 bg-surface border border-border-dim rounded-[10px] shadow-2xl text-xs overflow-hidden z-50 py-1"
                    style={{ marginLeft: `${depth * 12 + 20}px` }}
                >
                    {isFolder && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); onCreateFile?.(node.id); setContextMenu(false); }}
                                className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-subtle text-text-main text-left text-xs"
                            >
                                <Plus size={12} /> New File
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onCreateFolder?.(node.id); setContextMenu(false); }}
                                className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-subtle text-text-main text-left text-xs"
                            >
                                <FolderPlus size={12} /> New Folder
                            </button>
                        </>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); setRenaming(true); setRenameValue(node.name || ''); }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-subtle text-text-main text-left text-xs"
                    >
                        <Pencil size={12} /> Rename
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete?.(node.id); setContextMenu(false); }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-semantic-danger/10 text-semantic-danger text-left text-xs"
                    >
                        <Trash2 size={12} /> Delete
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setContextMenu(false); }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-subtle text-text-dim text-left border-t border-border-dim text-xs"
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
                            className="text-[11px] text-text-dim italic px-2 py-0.5"
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
        <div className="flex h-full flex-col rounded-[10px] border border-border-dim bg-surface text-xs overflow-hidden">
            <div className="border-b border-border-dim bg-subtle px-3 py-2 text-xs font-medium text-text-main flex items-center justify-between">
                <span>Explorer</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onCreateFile?.(null)}
                        className="p-1 hover:bg-surface rounded text-text-sub hover:text-text-main transition-colors"
                        title="New File"
                    >
                        <Plus size={13} />
                    </button>
                    <button
                        onClick={() => onCreateFolder?.(null)}
                        className="p-1 hover:bg-surface rounded text-text-sub hover:text-text-main transition-colors"
                        title="New Folder"
                    >
                        <FolderPlus size={13} />
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 text-xs text-text-sub custom-scrollbar">
                {items.length === 0 ? (
                    <div className="px-2 py-4 text-text-dim text-center text-xs">No files yet. Create one above.</div>
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
