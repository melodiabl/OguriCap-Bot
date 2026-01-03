import React from 'react';

interface DonutChartProps {
  percentage: number;
  color?: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

interface BarChartProps {
  data: Array<{
    label: string;
    value: number;
  }>;
  maxValue?: number;
  color?: string;
  height?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  percentage,
  color = '#3b82f6',
  size = 120,
  strokeWidth = 8,
  label,
}) => {
  // Ensure percentage is between 0 and 100
  const validPercentage = Math.min(Math.max(percentage, 0), 100);
  
  // Calculate the circumference of the circle
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate stroke-dasharray based on percentage
  // The stroke-dasharray represents the "filled" portion of the circle
  const strokeDasharray = (validPercentage / 100) * circumference;
  
  // Center position
  const center = size / 2;

  return (
    <div className="flex flex-col items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${strokeDasharray} ${circumference}`}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dasharray 0.3s ease',
          }}
        />
      </svg>
      {label && (
        <div className="mt-2 text-center">
          <p className="text-sm font-semibold text-gray-700">{label}</p>
          <p className="text-lg font-bold text-gray-900">{validPercentage.toFixed(1)}%</p>
        </div>
      )}
    </div>
  );
};

export const BarChart: React.FC<BarChartProps> = ({
  data,
  maxValue,
  color = '#3b82f6',
  height = 200,
}) => {
  // Calculate max value for scaling
  const calculatedMaxValue =
    maxValue || Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-2 px-2 py-4" style={{ minHeight: `${height}px` }}>
        {data.map((item, index) => {
          const barHeight = (item.value / calculatedMaxValue) * height;
          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center gap-2 min-w-[40px]"
            >
              <div className="flex items-end justify-center w-full" style={{ height: `${height}px` }}>
                <div
                  className="w-full rounded-t-md transition-all duration-300 hover:opacity-80"
                  style={{
                    backgroundColor: color,
                    height: `${barHeight}px`,
                  }}
                  title={`${item.label}: ${item.value}`}
                />
              </div>
              <label className="text-xs text-gray-600 text-center truncate w-full">
                {item.label}
              </label>
              <span className="text-xs font-semibold text-gray-900">
                {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
