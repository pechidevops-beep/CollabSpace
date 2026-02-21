import { useState, useEffect, useMemo } from 'react';
import { getWorkspaceMemberRole } from '../services/workspaceService';
import { useAuth } from '../context/AuthContext';

/**
 * Permission matrix for RBAC roles.
 * Roles: owner > admin > contributor > viewer
 */
const ROLE_HIERARCHY = ['viewer', 'contributor', 'admin', 'owner'];

const PERMISSIONS = {
    owner: {
        canDeleteWorkspace: true,
        canManageMembers: true,
        canChangeRoles: true,
        canCreateRepo: true,
        canEditRepo: true,
        canDeleteRepo: true,
        canEditFiles: true,
        canCommit: true,
        canCreateAssignment: true,
        canGradeSubmissions: true,
        canViewAll: true,
    },
    admin: {
        canDeleteWorkspace: false,
        canManageMembers: true,
        canChangeRoles: true,
        canCreateRepo: true,
        canEditRepo: true,
        canDeleteRepo: true,
        canEditFiles: true,
        canCommit: true,
        canCreateAssignment: true,
        canGradeSubmissions: true,
        canViewAll: true,
    },
    contributor: {
        canDeleteWorkspace: false,
        canManageMembers: false,
        canChangeRoles: false,
        canCreateRepo: true,
        canEditRepo: true,
        canDeleteRepo: false,
        canEditFiles: true,
        canCommit: true,
        canCreateAssignment: false,
        canGradeSubmissions: false,
        canViewAll: true,
    },
    viewer: {
        canDeleteWorkspace: false,
        canManageMembers: false,
        canChangeRoles: false,
        canCreateRepo: false,
        canEditRepo: false,
        canDeleteRepo: false,
        canEditFiles: false,
        canCommit: false,
        canCreateAssignment: false,
        canGradeSubmissions: false,
        canViewAll: true,
    },
};

const DEFAULT_PERMISSIONS = PERMISSIONS.viewer;

/**
 * Hook: usePermissions(workspaceId)
 * Returns current user's role and computed permissions for the given workspace.
 */
export function usePermissions(workspaceId) {
    const { user } = useAuth();
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspaceId || !user?.id) {
            setRole(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        getWorkspaceMemberRole(workspaceId, user.id)
            .then((r) => {
                if (!cancelled) {
                    // Map legacy 'member' to 'contributor'
                    setRole(r === 'member' ? 'contributor' : r);
                }
            })
            .catch(() => {
                if (!cancelled) setRole(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [workspaceId, user?.id]);

    const permissions = useMemo(() => {
        if (!role) return DEFAULT_PERMISSIONS;
        return PERMISSIONS[role] || DEFAULT_PERMISSIONS;
    }, [role]);

    return {
        role,
        loading,
        ...permissions,
        isOwner: role === 'owner',
        isAdmin: role === 'admin',
        isContributor: role === 'contributor',
        isViewer: role === 'viewer',
        hasRole: (minRole) => {
            const currentIdx = ROLE_HIERARCHY.indexOf(role);
            const requiredIdx = ROLE_HIERARCHY.indexOf(minRole);
            return currentIdx >= requiredIdx;
        },
    };
}

/**
 * Get permission object from role string (for non-hook usage).
 */
export function getPermissionsForRole(role) {
    const normalizedRole = role === 'member' ? 'contributor' : role;
    return PERMISSIONS[normalizedRole] || DEFAULT_PERMISSIONS;
}

/**
 * List of available roles for the role selector dropdown.
 */
export const AVAILABLE_ROLES = [
    { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
    { value: 'contributor', label: 'Contributor', description: 'Can edit code and create repos' },
    { value: 'admin', label: 'Admin', description: 'Can manage members and settings' },
    { value: 'owner', label: 'Owner', description: 'Full control' },
];
