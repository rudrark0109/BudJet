import { LeftSection } from './LeftSection';
import { RightSection } from './RightSection';

export function SplitLayout() {
  return (
    <div className="split-layout">
      {/* Left side - 1/3 width */}
      <div className="layout-left">
        <RightSection />
      </div>

      {/* Right side - 2/3 width */}
      <div className="layout-right">
        <LeftSection />
      </div>
    </div>
  );
}
