"""Geospatial validation service for BuffQuest.

Calculates real-world distances between user coordinates and building zones
to enforce physical presence constraints.
"""

import math
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.building_zone import BuildingZone

def calculate_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points using the Haversine formula."""
    R = 6371e3  # Earth radius in meters
    phi1 = lat1 * math.pi / 180
    phi2 = lat2 * math.pi / 180
    delta_phi = (lat2 - lat1) * math.pi / 180
    delta_lambda = (lon2 - lon1) * math.pi / 180

    a = math.sin(delta_phi / 2) * math.sin(delta_phi / 2) + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2) * math.sin(delta_lambda / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

async def verify_user_in_zone(
    db: AsyncSession,
    building_zone_id: int,
    user_lat: float,
    user_lon: float,
    allowed_radius_meters: float = 150.0
) -> BuildingZone:
    """Verify that a user's coordinates fall within the specified radius of the zone.
    
    Raises 404 if zone is invalid.
    Raises 403 if user is too far away.
    """
    result = await db.execute(select(BuildingZone).where(BuildingZone.id == building_zone_id))
    zone = result.scalar_one_or_none()
    
    if zone.latitude is None or zone.longitude is None:
        # For now, if no point is defined, we allow it if polygons are the intended method.
        # Ideally, we'd implement point-in-polygon here.
        return zone
        
    distance = calculate_distance_meters(
        user_lat, user_lon, 
        float(zone.latitude), float(zone.longitude)
    )
    
    if distance > allowed_radius_meters:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, 
            detail=f"You are {int(distance)} meters away. You must be within {int(allowed_radius_meters)}m of {zone.name}."
        )
        
    return zone
