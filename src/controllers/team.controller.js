import { asyncHandler } from "../utils/asyncHandler.js";
import { Team } from "../models/team.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";


const createTeam = asyncHandler(async (req, res) => {
    try {
        const {
            teamName,
            shortName,
            location,
            teamtype,
        } = req.body;
        console.log("body", req.body);
        console.log("files", req.files);
        const existingTeam = await Team.findOne({ $or: [{ teamName }, { shortName }] });
        if (existingTeam) {
            throw new ApiError(409, "Team with the same name or short name already exists");
        }
        // let teamLogoLocalPath;
        // if (req.files && Array.isArray(req.files.teamLogo) && req.files.teamLogo.length > 0) {
        //     teamLogoLocalPath = req.files.teamLogo[0].path;
        // }
        // const teamLogo = await uploadOnCloudinary(teamLogoLocalPath);
        // console.log("teamLogo", teamLogo);

        let teamLogoLocalPath;
        if (req.files && Array.isArray(req.files.teamLogo) && req.files.teamLogo.length > 0) {
            teamLogoLocalPath = req.files.teamLogo[0].path;
        }
        const teamLogo = await uploadOnCloudinary(teamLogoLocalPath);
        console.log(teamLogo);

        const sanitizedData = {
            teamLogo: teamLogo?.url.trim() || "",
            teamName: teamName?.trim(),
            shortName: shortName?.trim(),
            location: location?.trim(),
            teamtype: teamtype?.trim(),
        };

        console.log("sanitizedData", sanitizedData);
        const team = new Team(sanitizedData);
        await team.save();

        const createdTeam = await Team.findById(team._id)
            .select('teamLogo name shortName location teamtype');

        return res.status(201).json(
            new ApiResponse(201, createdTeam, "Team created successfully")
        );
    } catch (error) {
        throw new ApiError(500, error);
    }
});
const updateTeam = asyncHandler(async (req, res) => {
    try {

        const { id } = req.params;
        const { teamName, shortName, location, teamtype } = req.body;
        console.log(req.files);

        console.log(req.body);
        if (!teamName?.trim() || !shortName?.trim() || !teamtype?.trim()) {
            throw new ApiError(400, "Name, shortName, and teamtype are required");
        }
        const team = await Team.findById(id);
        if (!team) {
            throw new ApiError(404, "Team not found");
        }

        // Check if the new name or short name already exists in another team
        const existingTeam = await Team.findOne({
            $or: [{ teamName }, { shortName }],
            _id: { $ne: id }
        });

        if (existingTeam) {
            throw new ApiError(409, "Another team with the same name or short name already exists");
        }

        let teamLogoLocalPath;
        if (req.files && Array.isArray(req.files.teamLogo) && req.files.teamLogo.length > 0) {
            teamLogoLocalPath = req.files.teamLogo[0].path;
        }
        const teamLogo = await uploadOnCloudinary(teamLogoLocalPath);
        console.log(teamLogo);

        team.teamLogo = teamLogo?.url.trim() || team.teamLogo;
        team.teamName = teamName.trim();
        team.shortName = shortName.trim();
        team.location = location?.trim() || team.location;
        team.teamtype = teamtype.trim();

        // Save the updated team
        await team.save();

        return res.status(200).json(
            new ApiResponse(200, team, "Team updated successfully")
        );
    } catch (error) {
        throw new ApiError(500, "An error occurred while updating the team");
    }
});
const getAllTeams = asyncHandler(async (req, res) => {
    try {
        const teams = await Team.find().select("-__v"); // Exclude the `__v` field

        if (!teams || teams.length === 0) {
            throw new ApiError(404, "No teams found");
        }

        return res.status(200).json(
            new ApiResponse(200, teams, "Teams fetched successfully")
        );
    } catch (error) {
        console.error("Error fetching teams:", error);
        throw new ApiError(500, "An error occurred while fetching teams");
    }
});

const deleteTeam = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        // Check if the team exists
        const team = await Team.findById(id);
        if (!team) {
            throw new ApiError(404, "Team not found");
        }

        // Delete the team
        await team.deleteOne();

        return res.status(200).json(
            new ApiResponse(200, null, "Team deleted successfully")
        );
    } catch (error) {
        throw new ApiError(500, "An error occurred while deleting the team");
    }
});

export {
    createTeam,
    updateTeam,
    deleteTeam,
    getAllTeams
}