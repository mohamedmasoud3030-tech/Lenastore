import React from 'react';
import { PageHeader, PageHeaderProps } from './PageHeader';
import { LoadingSkeleton } from './LoadingSkeleton';
import { ErrorState } from './ErrorState';

export interface PageContainerProps extends Partial<PageHeaderProps> {
  children?: React.ReactNode;
  loading?: boolean;
  loadingRows?: number;
  error?: string | null;
  onRetry?: () => void;
  kpiStats?: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  title,
  description,
  actions,
  headerActions,
  action,
  onBack,
  backTo,
  badge,
  icon,
  children,
  loading = false,
  loadingRows = 5,
  error = null,
  onRetry,
  kpiStats,
  toolbar,
  className = '',
}) => {
  const pageActions = headerActions || actions || action;

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {title && (
          <PageHeader
            title={title}
            description={description}
            actions={pageActions}
            onBack={onBack}
            backTo={backTo}
            badge={badge}
            icon={icon}
          />
        )}
        <LoadingSkeleton rows={loadingRows} />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {title && (
        <PageHeader
          title={title}
          description={description}
          actions={pageActions}
          onBack={onBack}
          backTo={backTo}
          badge={badge}
          icon={icon}
        />
      )}

      {error && <ErrorState message={error} onRetry={onRetry} />}

      {kpiStats && <div className="space-y-4">{kpiStats}</div>}

      {toolbar && <div className="space-y-4">{toolbar}</div>}

      {children && <div className="space-y-6">{children}</div>}
    </div>
  );
};
