from app.models.user import UserProfile
from fastapi import APIRouter, Depends, HTTPException
from app.services.role_service import require_government
from app.services.appwrite_service import AppwriteService
from app.services.second_workflow import create_generate_disaster_task_graph
from app.models.disaster import DisasterRequest
from app.models.resource import ResourcePayload, DeleteResourceRequest, UpdateAvailabilityRequest


router = APIRouter(prefix="/gov", tags=["Government"])
appwrite_service = AppwriteService()


@router.post("/emergency/accept")
async def accept_disaster(payload: DisasterRequest, user: UserProfile = Depends(require_government)):
    try:
        disaster = appwrite_service.get_disaster(payload.disaster_id)
        current_status = disaster.get("status")
        if current_status == "active":
            return {"message": f"Disaster {payload.disaster_id} is already active. No action taken."}
        appwrite_service.update_disaster_status(payload.disaster_id, "active")
        graph = create_generate_disaster_task_graph()
        graph.invoke({"disaster_id": payload.disaster_id})
        return {"message": f"Disaster {payload.disaster_id} marked as active."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.post("/emergency/reject")
async def reject_disaster(payload: DisasterRequest, user: UserProfile = Depends(require_government)):
    try:
        appwrite_service.archive_disaster(payload.disaster_id)
        
        return {"message": f"Disaster {payload.disaster_id} archived."}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.post("/resource/add")
async def add_resource(payload: ResourcePayload, user: UserProfile = Depends(require_government)):
    try:
        appwrite_service.add_resource_to_disaster(payload.disasterId, payload.data)
        
        return {"message": "Resource added successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add resource: {str(e)}")
    
@router.delete("/resource/delete")
async def delete_resource(payload: DeleteResourceRequest, user: UserProfile = Depends(require_government)):
    try:
        appwrite_service.delete_resource(payload.resource_id)
        return {"message": f"Resource {payload.resource_id} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete resource: {str(e)}")

@router.patch("/resource/update-availability")
async def update_resource_availability(payload: UpdateAvailabilityRequest, user: UserProfile = Depends(require_government)):
    try:
        appwrite_service.update_resource_availability(payload.resource_id, payload.availability)
        return {"message": f"Resource {payload.resource_id} availability updated to {payload.availability}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update availability: {str(e)}")
    
