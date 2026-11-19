# Backend Django de Paseo Aranjuez 360 (API, admin de Django, invitaciones con QR).
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Al arrancar: migra la base, junta los estáticos del admin y levanta gunicorn.
# Timeout amplio: Jarvis llama al LLM y a la voz, que pueden tardar varios segundos.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn paseo_erp.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120 --access-logfile -"]
