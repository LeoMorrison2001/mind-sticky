'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';

export default function FunctionBar() {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="fixed top-6 right-6 z-50">
      {/* 信息按钮 */}
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="w-12 h-12 bg-white hover:bg-gray-50 text-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group relative"
        title="关于"
      >
        <Info size={20} />
        <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-800 text-white px-2 py-1 rounded-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          关于
        </div>
      </button>

      {/* 信息弹窗 */}
      {showInfo && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-xl shadow-2xl border border-gray-200 min-w-[200px] overflow-hidden">
          {/* 背景遮罩 - 点击外部关闭 */}
          {showInfo && (
            <div
              className="fixed inset-0 z-[-1]"
              onClick={() => setShowInfo(false)}
            />
          )}

          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-800 mb-2">思维贴</h3>
            <p className="text-xs text-gray-600">版本 1.0.0</p>
            <p className="text-xs text-gray-500 mt-2">一个简单的思维便签应用</p>
          </div>
        </div>
      )}
    </div>
  );
}