import { useCallback, useEffect, useRef, useState } from 'react';
import { verifyPassword } from '@/lib/password-utils';
import { ConfirmDialog } from '@/components/workspace/dialogs/ConfirmDialog';
import type { PromptGalleryMode } from '@/hooks/usePromptGalleryConfig';

// 加盐后的密码哈希（需要更新：用 hashPassword 生成新的哈希值替换下方占位符）
const PASSWORD_HASH = 'REPLACE_WITH_NEW_SALTED_HASH';
// 旧的无盐哈希，用于向后兼容验证
const LEGACY_PASSWORD_HASH = '0572f0f48c9d4da7f59ccfff270df8a46297128f367248c5319ffe5b16e2f3ad';

/** 验证密码：先尝试加盐哈希，失败后回退无盐哈希（向后兼容） */
async function checkPassword(password: string): Promise<boolean> {
  if (PASSWORD_HASH !== 'REPLACE_WITH_NEW_SALTED_HASH') {
    const isValid = await verifyPassword(password, PASSWORD_HASH);
    if (isValid) return true;
  }
  // 回退：使用无盐 SHA-256 验证旧哈希
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const legacyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return legacyHash === LEGACY_PASSWORD_HASH;
}

export function usePromptGalleryAccess(
  mode: PromptGalleryMode,
  onError: (message: string) => void,
  onUnlocked?: () => void,
) {
  const [showPromptGallery, setShowPromptGallery] = useState(mode === '1');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [, setClickCount] = useState(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (mode === '2') return;

    queueMicrotask(() => {
      setShowPromptGallery(mode === '1');
    });
  }, [mode]);

  const handlePromptGalleryEntry = useCallback(() => {
    if (mode === '3') return;
    if (mode === '1') {
      onUnlocked?.();
      return;
    }
    // mode === '2' 私密模式：7次点击 + 密码验证
    if (showPromptGallery) return;

    setClickCount(prev => {
      const next = prev + 1;
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      if (next >= 7) {
        setPasswordDialogOpen(true);
        return 0;
      }
      clickTimerRef.current = setTimeout(() => {
        setClickCount(0);
      }, 2000);
      return next;
    });
  }, [mode, showPromptGallery, onUnlocked]);

  const handlePasswordSubmit = useCallback(async () => {
    try {
      const isValid = await checkPassword(passwordInput);
      if (isValid) {
        setShowPromptGallery(true);
        setPasswordDialogOpen(false);
        setPasswordInput('');
        onUnlocked?.();
      } else {
        onError('密码错误');
        setPasswordInput('');
      }
    } catch {
      onError('密码验证失败');
    }
  }, [onError, onUnlocked, passwordInput]);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  return {
    showPromptGallery,
    passwordDialogOpen,
    passwordInput,
    setPasswordDialogOpen,
    setPasswordInput,
    handlePromptGalleryEntry,
    handlePasswordSubmit,
  };
}

export function PromptGalleryAccessDialog({
  open,
  passwordInput,
  onPasswordChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  passwordInput: string;
  onPasswordChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  return (
    <ConfirmDialog
      title="提示词广场验证"
      message={
        <div className="space-y-3">
          <p>请输入密码以开启提示词广场。</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(event) => onPasswordChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onSubmit();
              }
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            autoFocus
          />
        </div>
      }
      confirmText="验证"
      variant="default"
      onConfirm={onSubmit}
      onCancel={onClose}
    />
  );
}