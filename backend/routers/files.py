"""File upload route."""
import os
import uuid

from fastapi import APIRouter, Depends, UploadFile, File

from config import settings
from auth import get_current_user

router = APIRouter(prefix="/api", tags=["files"], dependencies=[Depends(get_current_user)])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    # Relative path: request.base_url reflects the proxy's internal host
    # (e.g. http://backend:8000), which the browser cannot resolve.
    return {"file_url": f"/uploads/{filename}"}