export interface DataSource {
  id: string;
  name: string;
  url: string;
  sector: string[];
  function: string[];
  type: 'free' | 'premium' | 'api';
  trust_level: 'high' | 'medium' | 'low';
  description: string;
  requires_auth: boolean;
  update_frequency: 'realtime' | 'daily' | 'weekly' | 'monthly';
}

export const DATA_SOURCES_REPOSITORY: DataSource[] = [
  // Financial Services Sources
  {
    id: 'bloomberg',
    name: 'Bloomberg Terminal',
    url: 'https://www.bloomberg.com/professional',
    sector: ['Financial Services', 'Banking', 'Investment'],
    function: ['Market Analysis', 'Financial Planning', 'Risk Assessment'],
    type: 'premium',
    trust_level: 'high',
    description: 'Comprehensive financial data and analytics platform',
    requires_auth: true,
    update_frequency: 'realtime'
  },
  {
    id: 'reuters',
    name: 'Reuters',
    url: 'https://www.reuters.com',
    sector: ['Financial Services', 'General'],
    function: ['Market Analysis', 'News', 'Risk Assessment'],
    type: 'free',
    trust_level: 'high',
    description: 'Global news and financial information',
    requires_auth: false,
    update_frequency: 'realtime'
  },
  {
    id: 'sec_edgar',
    name: 'SEC EDGAR',
    url: 'https://www.sec.gov/edgar.shtml',
    sector: ['Financial Services', 'Public Companies'],
    function: ['Financial Analysis', 'Regulatory Compliance'],
    type: 'free',
    trust_level: 'high',
    description: 'SEC filings for public companies',
    requires_auth: false,
    update_frequency: 'daily'
  },

  // Technology Sources
  {
    id: 'crunchbase',
    name: 'Crunchbase',
    url: 'https://www.crunchbase.com',
    sector: ['Technology', 'Startups'],
    function: ['Market Analysis', 'Competitive Analysis'],
    type: 'premium',
    trust_level: 'medium',
    description: 'Startup and technology company database',
    requires_auth: true,
    update_frequency: 'daily'
  },
  {
    id: 'gartner',
    name: 'Gartner',
    url: 'https://www.gartner.com',
    sector: ['Technology', 'IT Services'],
    function: ['Market Analysis', 'Strategic Planning'],
    type: 'premium',
    trust_level: 'high',
    description: 'IT research and advisory company',
    requires_auth: true,
    update_frequency: 'weekly'
  },

  // Market Research Sources
  {
    id: 'statista',
    name: 'Statista',
    url: 'https://www.statista.com',
    sector: ['General'],
    function: ['Market Analysis', 'Data Analytics'],
    type: 'premium',
    trust_level: 'high',
    description: 'Market and consumer data platform',
    requires_auth: true,
    update_frequency: 'weekly'
  },
  {
    id: 'eu_statistics',
    name: 'Eurostat',
    url: 'https://ec.europa.eu/eurostat',
    sector: ['General', 'Government'],
    function: ['Market Analysis', 'Economic Analysis'],
    type: 'free',
    trust_level: 'high',
    description: 'European Union statistical office',
    requires_auth: false,
    update_frequency: 'monthly'
  },

  // Automotive & EV Specific
  {
    id: 'acea',
    name: 'European Automobile Manufacturers Association',
    url: 'https://www.acea.auto',
    sector: ['Automotive', 'Manufacturing'],
    function: ['Market Analysis', 'Industry Reports'],
    type: 'free',
    trust_level: 'high',
    description: 'European automotive industry association',
    requires_auth: false,
    update_frequency: 'monthly'
  },
  {
    id: 'ev_volumes',
    name: 'EV Volumes',
    url: 'https://www.ev-volumes.com',
    sector: ['Automotive', 'Energy'],
    function: ['Market Analysis', 'Sales Data'],
    type: 'premium',
    trust_level: 'medium',
    description: 'Electric vehicle sales data and market analysis',
    requires_auth: true,
    update_frequency: 'monthly'
  },

  // General Business Sources
  {
    id: 'linkedin',
    name: 'LinkedIn',
    url: 'https://www.linkedin.com',
    sector: ['General'],
    function: ['Company Research', 'Market Intelligence'],
    type: 'free',
    trust_level: 'medium',
    description: 'Professional networking and company information',
    requires_auth: false,
    update_frequency: 'daily'
  },
  {
    id: 'google_scholar',
    name: 'Google Scholar',
    url: 'https://scholar.google.com',
    sector: ['General', 'Research'],
    function: ['Research', 'Academic Analysis'],
    type: 'free',
    trust_level: 'high',
    description: 'Academic research and papers',
    requires_auth: false,
    update_frequency: 'daily'
  }
];