import { LeftSection } from './LeftSection';
import { RightSection } from './RightSection';

export function SplitLayout({ userId, refreshKey }) {
  return (
    <div className="split-layout">
      {/* Left side - 1/3 width */}
      <div className="layout-left">
        <RightSection userId={userId} refreshKey={refreshKey} />
      </div>

      {/* Right side - 2/3 width */}
      <div className="layout-right">
        <LeftSection userId={userId} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
