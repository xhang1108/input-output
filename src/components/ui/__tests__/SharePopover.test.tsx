/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SharePopover } from '../SharePopover';
import React from 'react';

// Mock next-auth/react
const mockSession = vi.hoisted(() => ({
    data: null,
    status: 'unauthenticated',
}));

vi.mock('next-auth/react', () => ({
    useSession: () => mockSession,
    signIn: vi.fn(),
}));

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

// Mock framer-motion to skip animations in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('SharePopover', () => {
    const defaultProps = {
        projectId: 'test-project',
        visibility: 'private' as const,
        isOpen: true,
        showTrigger: false,
    };

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('renders login reminder for unauthenticated users', () => {
        mockSession.status = 'unauthenticated';
        mockSession.data = null;

        render(<SharePopover {...defaultProps} />);

        expect(screen.getByText(/Cloud Sharing Disabled/i)).toBeDefined();
        expect(screen.getByText(/Sign in with Google/i)).toBeDefined();
    });

    it('renders "Save to Cloud" hint for local projects when authenticated', () => {
        mockSession.status = 'authenticated';
        mockSession.data = { user: { id: 'user-1' } } as any;

        render(<SharePopover {...defaultProps} projectId="local:123" />);

        expect(screen.getByText(/Share to Cloud/i)).toBeDefined();
        expect(screen.getByText(/This is a local project/i)).toBeDefined();
    });

    it('renders visibility toggles for cloud projects when authenticated', () => {
        mockSession.status = 'authenticated';
        mockSession.data = { user: { id: 'user-1' } } as any;
        const onVisibilityChange = vi.fn();

        render(
            <SharePopover 
                {...defaultProps} 
                projectId="cloud:123" 
                onVisibilityChange={onVisibilityChange} 
            />
        );

        expect(screen.getByText(/Visibility/i)).toBeDefined();
        const publicButton = screen.getByText(/Public/i);
        fireEvent.click(publicButton);
        expect(onVisibilityChange).toHaveBeenCalledWith('public');
    });

    it('renders share link when visibility is public', () => {
        mockSession.status = 'authenticated';
        mockSession.data = { user: { id: 'user-1' } } as any;

        render(
            <SharePopover 
                {...defaultProps} 
                projectId="cloud:123" 
                visibility="public" 
            />
        );

        expect(screen.getByText(/Share Link/i)).toBeDefined();
        expect(screen.getByDisplayValue(/cloud:123/i)).toBeDefined();
    });
});
