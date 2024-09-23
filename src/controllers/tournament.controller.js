import { asyncHandler } from "../utils/asyncHandler.js";
import { Tournament } from "../models/tournament.model.js";
import { Squad } from "../models/squad.model.js";
import { Team } from "../models/team.model.js";
import { Player } from "../models/player.model.js";
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";


const getAllTournaments = asyncHandler(async (req, res) => {
    try {
        const tournaments = await Tournament.find();
        if (!tournaments || tournaments.length === 0) {
            throw new ApiError(404, "No tournaments found");
        }
        return res.status(200).json(
            new ApiResponse(200, tournaments, "Tournaments fetched successfully")
        );
    } catch (error) {
        throw new ApiError(500, "An error occurred while fetching tournaments");
    }
});
const createTournament = asyncHandler(async (req, res) => {
    const {
        season,
        startDate,
        endDate,
        name: inputName,
        shortName,
        ballType,
        tournamentType,
    } = req.body;


    if (!inputName?.trim() || !shortName?.trim() || !ballType?.trim() || !tournamentType?.trim()) {
        throw new ApiError(400, "Name, shortName, ballType, and tournamentType are required");
    }

    const name = inputName.trim();
    const existingTournament = await Tournament.findOne({ name, season });
    if (existingTournament) {
        throw new ApiError(409, "Tournament with this name and season already exists");
    }


    let imageLocalPath;

    if (req.files && Array.isArray(req.files.image) && req.files.image.length > 0) {
        imageLocalPath = req.files.image[0].path
    }

    const image = await uploadOnCloudinary(imageLocalPath)

    const tournamentData = {
        name,
        shortName: shortName.trim(),
        season,
        startDate,
        endDate,
        ballType,
        tournamentType,
        image: image?.url || "",
    };
    const tournament = await Tournament.create(tournamentData);
    if (!tournament) {
        throw new ApiError(400, "Tournament creation failed");
    }

    const createdTournament = await Tournament.findById(tournament._id);
    return res.status(201).json(
        new ApiResponse(200, createdTournament, "Tournament created successfully")
    );
});
const updateTournament = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        season,
        startDate,
        endDate,
        name: inputName,
        shortName,
        ballType,
        tournamentType,
    } = req.body;

    if (!inputName?.trim() || !shortName?.trim() || !ballType?.trim() || !tournamentType?.trim()) {
        throw new ApiError(400, "Name, shortName, ballType, and tournamentType are required");
    }

    const name = inputName.trim();

    const existingTournament = await Tournament.findOne({
        name,
        season,
        _id: { $ne: id }  // Exclude the current tournament by its _id
    });

    if (existingTournament) {
        throw new ApiError(409, "Tournament with this name and season already exists");
    }


    let imageLocalPath;
    if (req.files && Array.isArray(req.files.image) && req.files.image.length > 0) {
        imageLocalPath = req.files.image[0].path;
    }

    const image = imageLocalPath ? await uploadOnCloudinary(imageLocalPath) : null;

    const updatedTournament = await Tournament.findByIdAndUpdate(
        id,
        {
            name,
            shortName: shortName.trim(),
            season,
            startDate,
            endDate,
            ballType,
            tournamentType,
            ...(image && { image: image.url }), // Only update image if a new one is provided
        },
        { new: true, runValidators: true }
    );

    if (!updatedTournament) {
        throw new ApiError(400, "Tournament update failed");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedTournament, "Tournament updated successfully")
    );
});
const deleteTournament = asyncHandler(async (req, res) => {

    const { id } = req.params;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
        throw new ApiError(404, "Tournament not found");
    }

    await tournament.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, null, "Tournament deleted successfully")
    );
});
const getUpcomingTournaments = asyncHandler(async (req, res) => {
    const currentDate = new Date().toISOString();
    const tournaments = await Tournament.find({ startDate: { $gt: currentDate } });

    if (!tournaments.length) {
        throw new ApiError(404, "No upcoming tournaments found");
    }

    res.status(200).json(
        new ApiResponse(200, tournaments, "Upcoming tournaments fetched successfully")
    );
});
const getOngoingTournaments = asyncHandler(async (req, res) => {
    const currentDate = new Date().toISOString();
    const tournaments = await Tournament.find({
        startDate: { $lte: currentDate },
        endDate: { $gte: currentDate }
    });

    if (!tournaments.length) {
        throw new ApiError(404, "No ongoing tournaments found");
    }

    res.status(200).json(
        new ApiResponse(200, tournaments, "Ongoing tournaments fetched successfully")
    );
});
const getConcludedTournaments = asyncHandler(async (req, res) => {
    const currentDate = new Date().toISOString();
    const tournaments = await Tournament.find({ endDate: { $lt: currentDate } });

    if (!tournaments.length) {
        throw new ApiError(404, "No concluded tournaments found");
    }

    res.status(200).json(
        new ApiResponse(200, tournaments, "Concluded tournaments fetched successfully")
    );
});
const addTeamsToTournaments = asyncHandler(async (req, res) => {
    const { tournamentId, teamIds } = req.body;
    // console.log(req.body);


    // Validate required fields
    if (!tournamentId || !teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
        throw new ApiError(400, "Tournament ID and team IDs are required");
    }

    // Find the tournament by ID
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
        throw new ApiError(404, "Tournament not found");
    }

    // Add new teams to the tournament's teams array directly
    tournament.teams.push(...teamIds);

    // Create squads for each team being added
    const createdSquads = [];
    for (const teamId of teamIds) {
        try {
            const squad = new Squad({
                name: `${tournament.name} - Squad for Team ${teamId}`, // Adjust the naming convention as needed
                team: teamId,
                tournament: tournamentId,
                players: [] // Empty players array initially
            });

            // Save each squad to the database
            await squad.save();
            // console.log("Created squad for team:", teamId);
            createdSquads.push(squad);

            // Add squad _id to the tournament's squads array
            tournament.squads.push(squad._id);
        } catch (error) {
            // console.error(`Failed to create squad for team ${teamId}:`, error);
            throw new ApiError(500, `Failed to create squad for team ${teamId}`);
        }
    }

    // Save the updated tournament
    await tournament.save();
    // console.log("Tournament updated with new squads:", createdSquads);

    // Return the success response with the updated tournament and created squads
    return res.status(201).json(
        new ApiResponse(201, { tournament, squads: createdSquads }, "Teams added to tournament and squads created successfully")
    );
});
const removeTeamFromTournament = asyncHandler(async (req, res) => {
    const { tournamentId, squadId } = req.body;
    // console.log(squadId);


    // Validate required fields
    if (!tournamentId || !squadId) {
        throw new ApiError(400, 'Tournament ID and Squad ID are required');
    }

    // Find the tournament by ID
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
        throw new ApiError(404, 'Tournament not found');
    }

    // Check if the squad exists in the tournament's squads array
    const squadIndex = tournament.squads.indexOf(squadId);
    if (squadIndex === -1) {
        throw new ApiError(404, 'Squad not found in this tournament');
    }

    // Remove the squad ID from the tournament's squads array
    tournament.squads.splice(squadIndex, 1);

    // Save the updated tournament
    await tournament.save();

    // Delete the squad document from the Squad collection
    const squad = await Squad.findById(squadId);
    if (!squad) {
        throw new ApiError(404, 'Squad not found');
    }

    await squad.deleteOne();

    // Send a success response
    res.status(200).json(new ApiResponse(200, { squadId: squad._id }, 'Team removed from tournament and squad deleted successfully'));
});
const getAvailableTeamsForTournament = asyncHandler(async (req, res) => {
    const { tournamentId } = req.params;

    // Validate the tournament ID
    if (!tournamentId) {
        throw new ApiError(400, "Tournament ID is required");
    }

    // Find the tournament by ID
    const tournament = await Tournament.findById(tournamentId).populate('squads');
    if (!tournament) {
        throw new ApiError(404, "Tournament not found");
    }
    // console.log(tournament);


    // Extract the team IDs from the squads in the tournament
    const teamIdsInSquads = tournament.squads.map(squad => squad.team.toString());
    // console.log(teamIdsInSquads);

    // Fetch all teams
    const allTeams = await Team.find();

    // Filter out teams that are already in the squads of the tournament
    const teamsNotInTournament = allTeams.filter(team => !teamIdsInSquads.includes(team._id.toString()));

    // Return the teams that are not yet part of the tournament
    return res.status(200).json(new ApiResponse(200, teamsNotInTournament, "Teams not in the tournament retrieved successfully"));
});
const getSingleTournamentDetail = asyncHandler(async (req, res) => {
    const { id } = req.params;  // Get the tournament ID from the request parameters
    // console.log("id", id);

    try {
        const tournament = await Tournament.findById(id);  // Fetch the tournament from the database

        if (!tournament) {
            throw new ApiError(404, "Tournament not found");
        }

        return res.status(200).json(
            new ApiResponse(200, tournament, "Tournament details fetched successfully")
        );
    } catch (error) {
        if (error.name === 'CastError') {
            // Handle invalid ObjectId error
            throw new ApiError(400, "Invalid tournament ID");
        }
        throw new ApiError(500, "An error occurred while fetching tournament details");
    }
});
const getSingleTournamentSquads = asyncHandler(async (req, res) => {
    const { tournamentId } = req.params; // Extract tournamentId from request parameters
    // Fetch squads associated with the given tournament ID
    const squads = await Squad.find({ tournament: tournamentId }).populate('team').populate('players');
    // Return the squads in the response
    return res.status(200).json(
        new ApiResponse(200, squads, "Squads retrieved successfully")
    );
});
const getAvailablePlayersForTournament = asyncHandler(async (req, res) => {
    const { tournamentId, teamId } = req.params;

    // Validate the tournament ID and team ID
    if (!tournamentId || !teamId) {
        throw new ApiError(400, "Tournament ID and Team ID are required");
    }

    // Find the tournament by ID and populate squads and players
    const tournament = await Tournament.findById(tournamentId).populate({
        path: 'squads',
        populate: { path: 'players', select: '_id' } // Only populate player IDs
    });

    if (!tournament) {
        throw new ApiError(404, "Tournament not found");
    }

    // Collect all player IDs from all squads in the tournament
    const allPlayersInTournament = tournament.squads.reduce((allPlayerIds, squad) => {
        return allPlayerIds.concat(squad.players.map(player => player._id.toString())); // Get player IDs only
    }, []);





    // Find the team by ID and get the associated club
    const team = await Team.findById(teamId);
    if (!team) {
        throw new ApiError(404, "Team not found");
    }

    const clubId = team.associatedClub;
    // Assuming the team model has a `club` field

    // Find all players of the club
    const clubPlayers = await Player.find({ associatedClub: clubId });


    // Filter the club's players by removing those already part of any squad in the tournament
    const availablePlayers = clubPlayers.filter(player => !allPlayersInTournament.includes(player._id.toString()));

    // Return the available players
    return res.status(200).json(new ApiResponse(200, availablePlayers, "Available players for the team in the tournament retrieved successfully"));
});
const removePlayerFromSquad = asyncHandler(async (req, res) => {
    const { squadId, playerId } = req.body.playerId;
    console.log(squadId, playerId);

    // Validate required fields
    if (!squadId || !playerId) {
        throw new ApiError(400, "Squad ID and Player ID are required");
    }

    // Find the squad by squadId
    const squad = await Squad.findById(squadId);
    if (!squad) {
        throw new ApiError(404, "Squad not found");
    }

    // Check if the player is part of the squad's players array
    const playerIndex = squad.players.findIndex(player => player.toString() === playerId);

    if (playerIndex === -1) {
        throw new ApiError(404, "Player not found in the squad");
    }

    // Remove the player from the squad's players array
    squad.players.splice(playerIndex, 1);

    // Save the updated squad
    await squad.save();

    // Return a success response with the updated squad
    return res.status(200).json(
        new ApiResponse(200, squad, "Player removed from the squad successfully")
    );
});
const getTeamsInTournament = asyncHandler(async (req, res) => {
    const { tournamentId } = req.params;

    // Validate the tournament ID
    if (!tournamentId) {
        throw new ApiError(400, "Tournament ID is required");
    }

    // Find the tournament by ID and populate the squads field to get the teams
    const tournament = await Tournament.findById(tournamentId).populate('squads')
        .populate('venues'); // Populate the venues
    // .populate('officials'); // Populate the officials;
    if (!tournament) {
        throw new ApiError(404, "Tournament not found");
    }

    // Extract the teams from the squads in the tournament
    const teamsInTournament = await Team.find({
        _id: { $in: tournament.squads.map(squad => squad.team) }
    });

    // Return the teams that are part of the tournament
    return res.status(200).json(new ApiResponse(200, { teams: teamsInTournament, venues: tournament.venues }, "Teams in the tournament retrieved successfully"));
});
export {
    createTournament,
    updateTournament,
    deleteTournament,
    getAllTournaments,
    getUpcomingTournaments,
    getOngoingTournaments,
    getConcludedTournaments,
    addTeamsToTournaments,
    getSingleTournamentDetail,
    getAvailableTeamsForTournament,
    removeTeamFromTournament,
    getSingleTournamentSquads,
    getAvailablePlayersForTournament,
    removePlayerFromSquad,
    getTeamsInTournament
}