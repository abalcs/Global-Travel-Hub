# GTT KPI Report Generator

A modern web application for analyzing travel agent performance metrics. Upload Excel reports, visualize key performance indicators, compare teams, track trends over time, and generate professional PowerPoint presentations.

## Features

### Data Analysis
- **Multi-file Processing** — Upload and analyze 6 different report types: Trips, Quotes, Passthroughs, Hot Pass, Bookings, and Non-Converted leads
- **Date Range Filtering** — Filter all metrics by custom date ranges
- **Automatic Agent Detection** — Intelligently identifies agent columns across different file formats

### Performance Metrics
| Metric | Description |
|--------|-------------|
| T>Q % | Trip to Quote conversion rate |
| T>P % | Trip to Passthrough rate |
| P>Q % | Passthrough to Quote conversion rate |
| Hot Pass % | Hot passes relative to passthroughs |
| Non-Converted % | Lead non-conversion rate |

### Team Management
- Create and manage teams of agents
- Designate senior vs. non-senior agents
- Compare performance across teams with visual charts

### Visualization
- **Summary View** — Comprehensive tables with sortable metrics for all agents
- **Trends View** — Time-series charts showing performance over time
- **Team Comparison** — Side-by-side bar charts comparing team performance
- **Agent Analytics** — Individual agent performance analysis

### Export
- Generate PowerPoint presentations with department and team breakdowns
- Export-ready charts and tables

### Performance Optimizations
- Web Worker for parallel file processing
- IndexedDB storage for persistent raw data
- Optimized algorithms for large datasets

## Tech Stack

- **React 19** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tool and dev server
- **Tailwind CSS 4** — Styling
- **Recharts** — Data visualization
- **SheetJS (xlsx)** — Excel file parsing
- **PptxGenJS** — PowerPoint generation
- **IndexedDB** — Client-side data persistence

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/GTT_KPI_Report.git
cd GTT_KPI_Report

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building for Production

```bash
npm run build
npm run preview
```

## Usage

1. **Upload Files** — Drag and drop or click to upload the 6 required Excel files
2. **Set Date Range** (optional) — Filter data to a specific time period
3. **Analyze Data** — Click the "Analyze Data" button to process files
4. **Configure Teams** — Create teams and assign agents
5. **Designate Seniors** — Mark senior agents for comparative analysis
6. **Explore Results** — Switch between Summary and Trends views
7. **Export** — Generate a PowerPoint presentation of your findings

## File Requirements

The application expects Excel files (.xlsx, .xls, or .csv) with the following data:

| File | Required Columns |
|------|------------------|
| Trips | Agent name, Created date |
| Quotes | Agent name, Quote first sent date |
| Passthroughs | Agent name, Passthrough date |
| Hot Pass | Agent name, Created date |
| Bookings | Agent name, Booking date |
| Non-Converted | Agent name (linked via trip name) |

The application automatically detects common column name variations.

## Data Persistence

- Team configurations and senior designations are saved to localStorage
- Parsed raw data is stored in IndexedDB for instant reprocessing with different date filters
- Use "Clear Data" to reset all stored information

## License

MIT

---

Built with React + TypeScript + Vite
