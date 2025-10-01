from langgraph.graph import StateGraph
from typing import TypedDict
import uuid
from langchain_google_genai import ChatGoogleGenerativeAI
import os
import math
import json
from app.services.appwrite_service import AppwriteService
from dotenv import load_dotenv

load_dotenv()

appwrite_service = AppwriteService()

gemini = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash", google_api_key=os.getenv("GOOGLE_API_KEY")
)


class EmergencyRequestState(TypedDict):
    disaster_id: str
    user_id: str
    help: str
    urgency_type: str
    latitude: str
    longitude: str
    emergency_type: str
    nearby_resources: list
    generated_task: dict
    user_request_data: dict


def fetch_disaster_type(state: EmergencyRequestState) -> EmergencyRequestState:
    try:
        document = appwrite_service.get_disaster_document(state["disaster_id"])
        emergency_type = document.get("emergency_type", "general emergency")
        return {**state, "emergency_type": emergency_type}
    except Exception as e:
        raise ValueError(f"Disaster data not found: {e}")


def fetch_nearby_resources(state: EmergencyRequestState) -> EmergencyRequestState:
    try:
        documents = appwrite_service.list_resources_for_disaster(state["disaster_id"])
        nearby_resources = []
        user_lat = float(state["latitude"])
        user_lon = float(state["longitude"])
        for doc in documents:
            if doc.get("latitude") and doc.get("longitude"):
                resource_lat = float(doc["latitude"])
                resource_lon = float(doc["longitude"])
                distance = math.sqrt(
                    (user_lat - resource_lat) ** 2 + (user_lon - resource_lon) ** 2
                )
                resource_data = {**doc, "distance": distance, "resource_id": doc["$id"]}
                nearby_resources.append(resource_data)
        nearby_resources.sort(key=lambda x: x.get("distance", float("inf")))
        return {**state, "nearby_resources": nearby_resources[:5]}
    except Exception as e:
        return {**state, "nearby_resources": []}


def generate_emergency_task(state: EmergencyRequestState) -> EmergencyRequestState:
    help_needed = state["help"]
    urgency = state["urgency_type"]
    emergency_type = state["emergency_type"]
    latitude = state["latitude"]
    longitude = state["longitude"]
    nearby_resources = state["nearby_resources"]
    if urgency == "moderate":
        urgency = "medium"
    resource_info = ""
    if nearby_resources:
        resource_info = "Available nearby resources:\n"
        for resource in nearby_resources[:3]:
            resource_info += f"- {resource.get('name', 'Unknown')}: {resource.get('type', 'general')} at ({resource.get('latitude')}, {resource.get('longitude')})\n"
            resource_info += (
                f"  Description: {resource.get('description', 'No description')}\n"
            )
            resource_info += f"  Contact: {resource.get('contact', 'No contact')}\n"
            resource_info += f"  Status: {resource.get('status', 'unknown')}\n"
    else:
        resource_info = "No nearby resources identified."
    prompt = f"""
    You are an emergency response coordinator AI. A citizen has submitted an emergency request during a disaster. Your job is to create an actionable response task and assign the appropriate responder roles.

    CRITICAL: Most requests are LEGITIMATE emergency needs. Only flag as inappropriate if the request is clearly sexual, abusive, or a prank (e.g., "send kiss", "sexy time", "haha joke", "prank call").

    LEGITIMATE EMERGENCY NEEDS INCLUDE:
    - Food, water, shelter (ALWAYS legitimate - assign to volunteers)
    - Medical help, injuries, rescue (ALWAYS legitimate - assign to first responders)
    - Evacuation, safety concerns (ALWAYS legitimate)
    - Basic supplies, clothing, sanitation (ALWAYS legitimate - assign to volunteers)

    EMERGENCY REQUEST DETAILS:
    Emergency Type: {emergency_type}
    Help Needed: {help_needed}
    Urgency Level: {urgency}
    Location: ({latitude}, {longitude})

    {resource_info}

    AVAILABLE RESPONDER ROLES:
    - "vol" (Volunteers): For food, water, shelter, supplies, basic needs, welfare checks, non-medical assistance
    - "fr" (First Responders): For medical emergencies, injuries, rescue operations, fire, life-threatening situations
    - "both": For large-scale disasters affecting many people, mass casualties, or complex situations needing both professional and volunteer support

    ROLE ASSIGNMENT RULES:
    1. Food/Water/Hunger/Thirst/Supplies → "vol"
    2. Medical/Injury/Bleeding/Rescue/Fire → "fr"
    3. Mass casualties/Large groups/Complex disasters → "both"
    4. If inappropriate (sexual/prank) → create verification task for "vol"

    Generate JSON response:
    {{
        "description": "Clear, actionable task for responders (1-2 sentences). For food requests say 'Deliver food supplies to person at location'. For medical say 'Provide medical assistance to injured person at location'.",
        "roles": "exactly one: 'vol', 'fr', or 'both'",
        "reasoning": "Brief explanation of role assignment",
        "resource_utilization": "How to use nearby resources or 'none'"
    }}

    EXAMPLES:
    - "Need food" → {{"description": "Deliver food supplies to hungry person at location", "roles": "vol"}}
    - "Send sexy kiss" → {{"description": "Verify request details and assess if legitimate emergency assistance needed", "roles": "vol"}}
    - "Broken leg" → {{"description": "Provide medical assistance to person with leg injury", "roles": "fr"}}

    Respond ONLY with valid JSON. DO NOT ask questions or inquire - CREATE A TASK.
    """
    try:
        messages = [{"role": "user", "content": prompt}]
        response = gemini.invoke(messages)
        ai_response = response.content.strip()
        if ai_response.startswith("```json"):
            ai_response = ai_response.replace("```json", "").replace("```", "").strip()
        elif ai_response.startswith("```"):
            ai_response = ai_response.replace("```", "").strip()
        ai_data = json.loads(ai_response)
        ai_generated_description = ai_data.get("description", "").strip()
        ai_selected_role = ai_data.get("roles", "vol")
        if ai_selected_role == "both":
            valid_roles = ["vol", "fr"]
        elif ai_selected_role in ["vol", "fr"]:
            valid_roles = [ai_selected_role]
        else:
            valid_roles = ["vol"]
        if not ai_generated_description:
            raise ValueError("Empty description from Gemini")
        task_id = str(uuid.uuid4())
        task = {
            "task_id": task_id,
            "description": ai_generated_description,
            "status": "pending",
            "action_done_by": "",
            "roles": valid_roles,
            "emergency_type": emergency_type,
            "urgency_level": urgency,
            "latitude": float(latitude),
            "longitude": float(longitude),
            "help_needed": help_needed,
            "user_id": state["user_id"],
            "disaster_id": state["disaster_id"],
            "is_fallback": False,
            "first_Task": False,
            "ai_reasoning": ai_data.get("reasoning", "AI-determined role assignment"),
            "resource_utilization": ai_data.get("resource_utilization", "none"),
        }
        return {**state, "generated_task": task}
    except Exception as e:
        # Fallback logic with better keyword detection
        help_lower = help_needed.lower()
        emergency_lower = emergency_type.lower()

        # Check for truly inappropriate content (sexual, prank)
        inappropriate_keywords = [
            "sexy",
            "kiss",
            "love",
            "haha",
            "lol",
            "prank",
            "joke",
            "fake",
        ]
        is_inappropriate = any(
            keyword in help_lower for keyword in inappropriate_keywords
        )

        if is_inappropriate:
            description = "Verify request details and assess if legitimate emergency assistance is needed."
            roles = ["vol"]
        else:
            # Legitimate emergency keywords
            food_keywords = [
                "food",
                "hungry",
                "hunger",
                "starving",
                "eat",
                "meal",
                "water",
                "thirsty",
                "drink",
            ]
            medical_keywords = [
                "medical",
                "injury",
                "hurt",
                "bleeding",
                "unconscious",
                "rescue",
                "trapped",
                "fire",
                "pain",
                "sick",
                "ill",
            ]
            mass_keywords = [
                "many people",
                "multiple people",
                "crowd",
                "group",
                "families",
                "everyone",
            ]

            needs_food = any(keyword in help_lower for keyword in food_keywords)
            needs_medical = any(keyword in help_lower for keyword in medical_keywords)
            mass_casualty = any(keyword in help_lower for keyword in mass_keywords)

            if mass_casualty and (needs_medical or urgency == "high"):
                description = f"Coordinate emergency response for multiple people needing {help_needed} at location ({latitude}, {longitude})."
                roles = ["vol", "fr"]
            elif needs_medical or urgency == "high":
                description = f"Provide immediate medical assistance to person needing {help_needed} at location ({latitude}, {longitude})."
                roles = ["fr"]
            elif needs_food:
                description = f"Deliver food and water supplies to person at location ({latitude}, {longitude})."
                roles = ["vol"]
            else:
                description = f"Assist person needing {help_needed} at location ({latitude}, {longitude})."
                roles = ["vol"]

            # Add resource coordination if available
            if nearby_resources:
                closest_resource = nearby_resources[0]
                description += f" Coordinate with {closest_resource.get('name', 'nearby resource')} for assistance."

        task_id = str(uuid.uuid4())
        task = {
            "task_id": task_id,
            "description": description,
            "status": "pending",
            "action_done_by": "",
            "roles": roles,
            "emergency_type": emergency_type,
            "urgency_level": urgency,
            "latitude": float(latitude),
            "longitude": float(longitude),
            "help_needed": help_needed,
            "user_id": state["user_id"],
            "disaster_id": state["disaster_id"],
            "first_Task": False,
            "is_fallback": True,
            "ai_reasoning": "Intelligent fallback assignment based on context analysis",
        }
        return {**state, "generated_task": task}


def save_task_to_db(state: EmergencyRequestState) -> EmergencyRequestState:
    user_id = state["user_id"]
    disaster_id = state["disaster_id"]
    # Delete any existing tasks for this user and disaster before saving the new one
    try:
        existing_tasks = appwrite_service.list_tasks_by_user_and_disaster(
            user_id, disaster_id
        )
        for task in existing_tasks:
            task_id = task.get("$id") or task.get("task_id")
            # Only delete if first_Task is False (or missing)
            if task_id and not task.get("first_Task", False):
                try:
                    appwrite_service.databases.delete_document(
                        database_id=appwrite_service.database_id,
                        collection_id=appwrite_service.tasks_collection_Id,
                        document_id=task_id,
                    )
                except Exception as e:
                    pass
    except Exception as e:
        pass
    # Now save the new task
    try:
        appwrite_service.save_task_document(state["generated_task"])
    except Exception as e:
        pass
    return state


def save_user_request(state: EmergencyRequestState) -> EmergencyRequestState:
    user_id = state["user_id"]
    disaster_id = state["disaster_id"]
    user_request_data = {
        "disaster_id": disaster_id,
        "help": state["help"],
        "urgency_type": state["urgency_type"],
        "latitude": state["latitude"],
        "longitude": state["longitude"],
        "emergency_type": state["emergency_type"],
        "task_id": state["generated_task"]["task_id"],
        "status": "submitted",
        "feedback": None,
        "assigned_roles": state["generated_task"]["roles"],
        "ai_reasoning": state["generated_task"].get(
            "ai_reasoning", "No reasoning provided"
        ),
        "userId": user_id,
    }
    try:
        # Try to delete any existing request for this user
        try:
            appwrite_service.delete_user_request_document(user_id)
        except Exception as e:
            pass
        # Save the new request with user_id as the document ID
        appwrite_service.save_user_request_document(user_id, user_request_data)
    except Exception as e:
        pass
    return {**state, "user_request_data": user_request_data}


def create_emergency_request_graph():
    graph = StateGraph(EmergencyRequestState)
    graph.add_node("fetch_disaster", fetch_disaster_type)
    graph.add_node("fetch_resources", fetch_nearby_resources)
    graph.add_node("generate_task", generate_emergency_task)
    graph.add_node("save_task", save_task_to_db)
    graph.add_node("save_request", save_user_request)
    graph.set_entry_point("fetch_disaster")
    graph.add_edge("fetch_disaster", "fetch_resources")
    graph.add_edge("fetch_resources", "generate_task")
    graph.add_edge("generate_task", "save_task")
    graph.add_edge("save_task", "save_request")
    graph.set_finish_point("save_request")
    return graph.compile()


async def process_emergency_request(
    disaster_id: str,
    user_id: str,
    help: str,
    urgency_type: str,
    latitude: str,
    longitude: str,
):
    graph = create_emergency_request_graph()
    initial_state = EmergencyRequestState(
        disaster_id=disaster_id,
        user_id=user_id,
        help=help,
        urgency_type=urgency_type,
        latitude=latitude,
        longitude=longitude,
        emergency_type="",
        nearby_resources=[],
        generated_task={},
        user_request_data={},
    )
    result = await graph.ainvoke(initial_state)
    return result


def delete_task_by_id(task_id: str):
    """Delete a task document from the tasks collection by its ID."""
    try:
        appwrite_service.databases.delete_document(
            database_id=appwrite_service.database_id,
            collection_id=appwrite_service.tasks_collection_Id,
            document_id=task_id,
        )
    except Exception as e:
        pass
