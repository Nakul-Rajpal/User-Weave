FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY transcription_agent.py .

# Create transcripts directory
RUN mkdir -p /app/transcripts

# Set environment variables (will be overridden by Render)
ENV PYTHONUNBUFFERED=1

# Run the transcription agent
CMD ["python", "transcription_agent.py"]
