# ===========================================
# L'HAMZA F SEL'A - Docker Image
# Optimized for Playwright + Node.js
# ===========================================

# Use Playwright's official base image (includes browsers)
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV API_PORT=3000

# Create app user for security
RUN groupadd -r lhamza && useradd -r -g lhamza lhamza

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create data directories
RUN mkdir -p data/deals data/images/tech data/images/fashion data/images/home data/images/auto data/images/beauty

# Set ownership
RUN chown -R lhamza:lhamza /app

# Switch to non-root user
USER lhamza

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Default command: Start API server
CMD ["node", "src/api/server.js"]
