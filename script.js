document.addEventListener('DOMContentLoaded', () => {
    const ROWS = 8;
    const COLS = 4;
    const PLAYER_A = 'A'; // White
    const PLAYER_B = 'B'; // Black
    const NORMAL = 'normal';
    const SWAPPED = 'swapped';

    const boardElement = document.getElementById('game-board');
    const resetBtn = document.getElementById('reset-btn');
    const infoBtn = document.getElementById('info-btn');
    const historyBtn = document.getElementById('history-btn');
    const infoOverlay = document.getElementById('info-overlay');
    const historyOverlay = document.getElementById('history-overlay');
    const winOverlay = document.getElementById('win-overlay');
    const historyList = document.getElementById('history-list');
    const winMessage = document.getElementById('win-message');
    const overlayCloseButtons = document.querySelectorAll('.close-overlay-btn');
    const overlays = document.querySelectorAll('.overlay');

    let board = []; // 2D array: null or { player: PLAYER_A/B, state: NORMAL/SWAPPED }
    let currentPlayer = PLAYER_A;
    let selectedPiece = null; // { row, col }
    let legalMoves = []; // Array of { row, col }
    let moveHistory = []; // Array of { player, start, end, boardBefore }
    let historicalBoardState = null; // Stores a board state when viewing history
    let gameOver = false;
    let winner = null;
    let winPath = []; // Stores cells [{row, col}] of the winning path

    // --- Initialization ---

    function initGame() {
        board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
        currentPlayer = PLAYER_A;
        selectedPiece = null;
        legalMoves = [];
        moveHistory = [];
        historicalBoardState = null;
        gameOver = false;
        winner = null;
        winPath = [];

        // Place pieces - REVERSED ORIENTATION
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (r < 2) { // Player B (Black) at top (rows 0, 1 -> displayed as 8, 7)
                    board[r][c] = { player: PLAYER_B, state: NORMAL };
                } else if (r >= ROWS - 2) { // Player A (White) at bottom (rows 6, 7 -> displayed as 2, 1)
                    board[r][c] = { player: PLAYER_A, state: NORMAL };
                }
            }
        }

        historyBtn.disabled = true;
        renderBoard();
        updateStatusMessage(); // Optional: Indicate whose turn
        hideAllOverlays();
        console.log("Game Initialized. Player A's turn (Bottom)."); // Updated log
    }

    // --- Rendering ---
    // (renderBoard function remains the same, it renders based on the board array)
    function renderBoard(boardState = board) {
        boardElement.innerHTML = '';
        boardElement.classList.remove('game-over'); // Remove game over visual cues if any

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = r; // Internal row index (0-7)
                cell.dataset.col = c;

                // Checkerboard pattern
                cell.classList.add(((r + c) % 2 === 0) ? 'light' : 'dark');

                const pieceData = boardState[r][c];
                if (pieceData) {
                    const pieceImg = document.createElement('img');
                    pieceImg.classList.add('piece');
                    pieceImg.src = getPieceImage(pieceData.player, pieceData.state);
                    pieceImg.alt = `Player ${pieceData.player} ${pieceData.state}`;
                    cell.appendChild(pieceImg);
                }

                // Add highlights AFTER adding piece
                if (selectedPiece && selectedPiece.row === r && selectedPiece.col === c) {
                    cell.classList.add('selected');
                }

                if (legalMoves.some(move => move.row === r && move.col === c)) {
                    cell.classList.add('legal-move');
                     // Add specific class if it's a swap target
                    const targetPiece = boardState[r][c];
                    if (targetPiece && targetPiece.player !== currentPlayer) {
                         cell.classList.add('swap-target');
                    }
                }

                // Highlight winning path if game is over
                if (gameOver && winPath.some(pos => pos.row === r && pos.col === c)) {
                     cell.classList.add('win-path');
                }


                cell.addEventListener('click', () => handleCellClick(r, c));
                boardElement.appendChild(cell);
            }
        }
        // Add game over class to board if needed
         if (gameOver) {
            boardElement.classList.add('game-over');
        }
    }


    function getPieceImage(player, state) {
        const color = player === PLAYER_A ? 'white' : 'black';
        const type = state === NORMAL ? 'normal' : 'swapped';
        return `images/${color}_${type}.png`;
    }

    function updateStatusMessage() {
        // Optional: Implement a status display element if needed
        // e.g., document.getElementById('status').textContent = `Turn: Player ${currentPlayer}`;
    }

     // --- Event Handlers ---
     // (No changes needed in handleCellClick, resetBtn, infoBtn, historyBtn listeners,
     // overlayCloseButtons, or overlay backdrop listeners)
    function handleCellClick(row, col) {
        if (gameOver && !historicalBoardState) return; // No moves after game ends (unless viewing history)
        if (currentPlayer === PLAYER_B && !historicalBoardState) return; // Block human clicks during AI turn
        if (historicalBoardState) { // If viewing history, any click restores final state
            restoreFinalState();
            return;
        }


        const clickedCellPiece = board[row][col];

        if (selectedPiece) {
            // Check if clicking a legal move target
            const isLegalMove = legalMoves.some(move => move.row === row && move.col === col);
            if (isLegalMove) {
                makeMove(selectedPiece.row, selectedPiece.col, row, col);
            } else if (row === selectedPiece.row && col === selectedPiece.col) {
                // Clicking the selected piece again deselects it
                deselectPiece();
                renderBoard();
            } else if (clickedCellPiece && clickedCellPiece.player === currentPlayer) {
                // Clicking another of own pieces selects the new one
                deselectPiece(); // Deselect previous first
                selectPiece(row, col);
                renderBoard();
            } else {
                 // Clicking an invalid spot deselects
                 deselectPiece();
                 renderBoard();
            }
        } else {
            // No piece selected, try selecting if it's the current player's piece
            if (clickedCellPiece && clickedCellPiece.player === currentPlayer) {
                selectPiece(row, col);
                renderBoard();
            }
        }
    }

    resetBtn.addEventListener('click', initGame);
    infoBtn.addEventListener('click', () => showOverlay(infoOverlay));
    historyBtn.addEventListener('click', () => {
        if (!historyBtn.disabled) {
            displayMoveHistory();
            showOverlay(historyOverlay);
        }
    });

    overlayCloseButtons.forEach(button => {
        button.addEventListener('click', () => {
             const overlayId = button.getAttribute('data-overlay');
             hideOverlay(document.getElementById(overlayId));
             if (historicalBoardState) {
                 restoreFinalState(); // Restore final state when closing history overlay
             }
        });
    });

     // Close overlay by clicking outside content
    overlays.forEach(overlay => {
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) { // Check if click is on the backdrop itself
                hideOverlay(overlay);
                if (historicalBoardState) {
                     restoreFinalState(); // Restore final state when closing history overlay
                 }
            }
        });
    });


    // --- Game Logic ---
    // (selectPiece, deselectPiece, calculateLegalMoves, unmarkAllSwapped, switchPlayer remain the same)
     function selectPiece(row, col) {
        selectedPiece = { row, col };
        legalMoves = calculateLegalMoves(row, col);
        console.log(`Selected piece at (${row}, ${col}). Legal moves:`, legalMoves);
    }

    function deselectPiece() {
        selectedPiece = null;
        legalMoves = [];
    }

    function calculateLegalMoves(r, c) {
        const moves = [];
        const piece = board[r][c];
        if (!piece) return moves; // Should not happen if called correctly

        const pieceState = piece.state;
        const opponent = piece.player === PLAYER_A ? PLAYER_B : PLAYER_A;

        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue; // Skip self

                const nr = r + dr;
                const nc = c + dc;

                // Check bounds
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                    const targetCell = board[nr][nc];

                    if (targetCell === null) {
                        // Move to empty cell
                        moves.push({ row: nr, col: nc });
                    } else if (targetCell.player === opponent) {
                        // Can swap only with opponent's NORMAL piece
                        if (targetCell.state === NORMAL) {
                             moves.push({ row: nr, col: nc, isSwap: true });
                        }
                    }
                     // Cannot move to a cell occupied by own piece
                     // Cannot move to a cell occupied by opponent's SWAPPED piece
                }
            }
        }
        return moves;
    }

     function makeMove(startRow, startCol, endRow, endCol) {
        if (!selectedPiece || startRow !== selectedPiece.row || startCol !== selectedPiece.col) {
            console.error("Move error: Invalid start piece.");
            return;
        }

        const move = legalMoves.find(m => m.row === endRow && m.col === endCol);
        if (!move) {
            console.error("Move error: Invalid target cell.");
             deselectPiece(); // Deselect if move was invalid
             renderBoard();
            return;
        }

        // Record state *before* the move for history
        const boardBefore = JSON.parse(JSON.stringify(board));
        moveHistory.push({
            player: currentPlayer,
            start: { row: startRow, col: startCol },
            end: { row: endRow, col: endCol },
            boardBefore: boardBefore
        });


        const movingPiece = board[startRow][startCol];
        const targetPiece = board[endRow][endCol];

        if (targetPiece === null) {
            // Move to empty cell
            board[endRow][endCol] = movingPiece;
            board[startRow][startCol] = null;
            unmarkAllSwapped(); // Reset swapped status on empty move
            console.log(`Player ${currentPlayer} moved ${startRow},${startCol} to ${endRow},${endCol}. Swapped pieces reset.`);
        } else if (targetPiece.player !== currentPlayer && targetPiece.state === NORMAL) {
            // Swap move
            board[endRow][endCol] = { ...movingPiece, state: SWAPPED };
            board[startRow][startCol] = { ...targetPiece, state: SWAPPED };
             console.log(`Player ${currentPlayer} swapped ${startRow},${startCol} with ${endRow},${endCol}. Both marked SWAPPED.`);
        } else {
             console.error("Illegal move logic error!"); // Should have been caught by legalMoves check
             return;
        }


        deselectPiece();

        // Check for win BEFORE switching player
        const winCheckResult = checkWinCondition(currentPlayer); // << Uses updated checkWinCondition
        if (winCheckResult.win) {
             gameOver = true;
             winner = currentPlayer;
             winPath = winCheckResult.path;
             renderBoard(); // Render final board state with win path highlight
             handleWin(winner);
        } else {
             switchPlayer();
             renderBoard(); // Render board after move, before AI starts thinking
             if (currentPlayer === PLAYER_B && !gameOver) {
                 // Trigger AI move after a short delay for UX
                 setTimeout(triggerAIMove, 500);
             }
        }
    }

    function unmarkAllSwapped() {
        let changed = false;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board[r][c] && board[r][c].state === SWAPPED) {
                    board[r][c].state = NORMAL;
                    changed = true;
                }
            }
        }
        //if (changed) console.log("Unmarked swapped pieces.");
    }

    function switchPlayer() {
        currentPlayer = (currentPlayer === PLAYER_A) ? PLAYER_B : PLAYER_A;
        updateStatusMessage();
        console.log(`Turn switched. Player ${currentPlayer}'s turn.`);
    }

    // --- Win Condition ---

    function checkWinCondition(player) {
        // REVERSED ORIENTATION: Define start/target based on player and new orientation
        const startRow = (player === PLAYER_A) ? ROWS - 2 : 1; // A starts near bottom (idx 6), B near top (idx 1)
        const targetRow = (player === PLAYER_A) ? 1 : ROWS - 2; // A targets near top (idx 1), B targets near bottom (idx 6)

        const visited = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
        const queue = []; // Queue for BFS: stores {row, col, path}

        // Find all starting pieces for the player in their designated 'start' row
        for (let c = 0; c < COLS; c++) {
            // Ensure the piece exists and belongs to the player before starting BFS from it
            if (board[startRow] && board[startRow][c] && board[startRow][c].player === player) {
                queue.push({ row: startRow, col: c, path: [{ row: startRow, col: c }] });
                visited[startRow][c] = true;
            }
        }


        while (queue.length > 0) {
            const current = queue.shift();
            const { row, col, path } = current;

            // Check if we reached the target row
            if (row === targetRow) {
                 console.log(`Win detected for Player ${player}. Path:`, path);
                 return { win: true, path: path }; // Found a path
            }

            // Explore neighbors
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;

                    const nr = row + dr;
                    const nc = col + dc;

                    // Check bounds, if visited, and if it's the player's piece
                    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS &&
                        !visited[nr][nc] &&
                        board[nr] && board[nr][nc] && board[nr][nc].player === player) // Added check for board[nr] existence
                    {
                        visited[nr][nc] = true;
                        const newPath = [...path, { row: nr, col: nc }];
                        queue.push({ row: nr, col: nc, path: newPath });
                    }
                }
            }
        }

        return { win: false, path: [] }; // No path found
    }


    function handleWin(winningPlayer) {
         console.log(`Game Over! Player ${winningPlayer} wins!`);
         winMessage.textContent = `Player ${winningPlayer} Wins!`;
         showOverlay(winOverlay);
         historyBtn.disabled = false; // Enable history button

         // Auto-close win overlay after 5 seconds
         setTimeout(() => {
             if (winOverlay.classList.contains('active')) {
                 hideOverlay(winOverlay);
             }
         }, 5000);
    }

    // --- AI Opponent (Player B) ---
    // (triggerAIMove remains the same)
    function triggerAIMove() {
        if (gameOver) return;
        console.log("AI (Player B) is thinking...");

        const bestMove = findBestAIMove();

        if (bestMove) {
            console.log("AI chooses move:", bestMove);
            // Need to re-select the piece virtually for makeMove
            selectPiece(bestMove.start.row, bestMove.start.col);
            // Make sure the chosen end coords are in the recalculated legal moves
            // This should always be true if findBestAIMove works correctly
            if (legalMoves.some(m => m.row === bestMove.end.row && m.col === bestMove.end.col)) {
                 makeMove(bestMove.start.row, bestMove.start.col, bestMove.end.row, bestMove.end.col);
            } else {
                console.error("AI Logic Error: Chosen move is not legal according to recalculation?");
                // Fallback: Make *any* legal move? Or just log error.
                // For now, just log. If this happens, the AI logic needs debugging.
                deselectPiece(); // Clear selection state
            }

        } else {
            console.log("AI has no legal moves! (Should not happen in this game?)");
            // Handle stalemate? Or pass turn? For now, log it.
        }
    }

    // (findBestAIMove simulation logic remains the same, but calls updated evaluateBoardState and allowsOpponentWin)
     function findBestAIMove() {
        let possibleMoves = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board[r][c] && board[r][c].player === PLAYER_B) {
                    const moves = calculateLegalMoves(r, c);
                    moves.forEach(move => {
                        possibleMoves.push({
                            start: { row: r, col: c },
                            end: { row: move.row, col: move.col },
                            isSwap: !!move.isSwap // Store if it's a swap
                        });
                    });
                }
            }
        }

        if (possibleMoves.length === 0) return null;

        let bestScore = -Infinity;
        let bestMoves = []; // Store moves with the best score

        for (const move of possibleMoves) {
            // Simulate the move
            const tempBoard = JSON.parse(JSON.stringify(board));
            const movingPiece = tempBoard[move.start.row][move.start.col];
            const targetPiece = tempBoard[move.end.row][move.end.col];
            let wasEmptyMove = false;

             if (targetPiece === null) {
                 // Empty cell move
                 tempBoard[move.end.row][move.end.col] = movingPiece;
                 tempBoard[move.start.row][move.start.col] = null;
                 // Simulate unmarking swapped pieces
                 for (let r = 0; r < ROWS; r++) {
                    for (let c = 0; c < COLS; c++) {
                         if (tempBoard[r][c] && tempBoard[r][c].state === SWAPPED) {
                             tempBoard[r][c].state = NORMAL;
                         }
                    }
                 }
                 wasEmptyMove = true;
            } else {
                 // Swap move (only possible with NORMAL opponent)
                 tempBoard[move.end.row][move.end.col] = { ...movingPiece, state: SWAPPED };
                 tempBoard[move.start.row][move.start.col] = { ...targetPiece, state: SWAPPED };
            }


            const score = evaluateBoardState(tempBoard, PLAYER_B, move, wasEmptyMove); // << Uses updated evaluateBoardState

             // Check if this move allows Player A to win immediately
             if (!allowsOpponentWin(tempBoard, PLAYER_A)) { // << Uses updated allowsOpponentWin
                  if (score > bestScore) {
                       bestScore = score;
                       bestMoves = [move];
                  } else if (score === bestScore) {
                       bestMoves.push(move);
                  }
             } else {
                 console.log(`AI Avoids move: ${move.start.row},${move.start.col} -> ${move.end.row},${move.end.col} (allows Player A win)`);
                 // If all moves lead to a loss, the AI will have to pick one eventually
                 // We could give these moves a massive penalty instead of excluding them
                 // For now, let's try excluding them unless no other options exist.
                 // Revisit this if AI gets stuck. Let's add them back with a huge penalty.
                  const lossPenalty = -100000;
                   if (lossPenalty > bestScore) {
                       bestScore = lossPenalty;
                       bestMoves = [move];
                   } else if (lossPenalty === bestScore) {
                       bestMoves.push(move);
                   }
             }
        }

         // If bestMoves is empty (maybe all moves led to immediate loss?), pick any move?
         // This shouldn't happen if we add the losing moves with a penalty.
         if (bestMoves.length === 0) {
             console.warn("AI couldn't find a non-losing move, or evaluation error. Picking random move.");
             // Ensure possibleMoves isn't empty before picking random
             if (possibleMoves.length > 0) {
                 return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
             } else {
                 return null; // Truly no moves available
             }
         }


        // Choose randomly among the best moves
        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }


    // (allowsOpponentWin simulation logic remains the same, but calls updated checkWinConditionForState)
     function allowsOpponentWin(boardState, opponentPlayer) {
         // Check if opponentPlayer has any move that wins from boardState
         for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                 if (boardState[r][c] && boardState[r][c].player === opponentPlayer) {
                    const opponentMoves = calculateLegalMovesForState(boardState, r, c);
                    for (const move of opponentMoves) {
                         // Simulate opponent's move
                         const nextBoardState = JSON.parse(JSON.stringify(boardState));
                         const movingPiece = nextBoardState[r][c];
                         const targetPiece = nextBoardState[move.row][move.col];

                         if (targetPiece === null) {
                              nextBoardState[move.row][move.col] = movingPiece;
                              nextBoardState[r][c] = null;
                              // Simulate unmarking (doesn't affect win check directly but good practice)
                               for (let rr = 0; rr < ROWS; rr++) {
                                   for (let cc = 0; cc < COLS; cc++) {
                                        if (nextBoardState[rr][cc] && nextBoardState[rr][cc].state === SWAPPED) {
                                             nextBoardState[rr][cc].state = NORMAL;
                                        }
                                   }
                                }
                         } else { // Swap
                             nextBoardState[move.row][move.col] = { ...movingPiece, state: SWAPPED };
                             nextBoardState[r][c] = { ...targetPiece, state: SWAPPED };
                         }


                         // Check if this simulated move results in a win for the opponent
                         if (checkWinConditionForState(nextBoardState, opponentPlayer).win) { // << Uses updated checkWinConditionForState
                              return true; // Found a winning move for the opponent
                         }
                    }
                 }
            }
         }
         return false; // No immediate winning move found for the opponent
     }


    // (calculateLegalMovesForState remains the same)
    function calculateLegalMovesForState(boardState, r, c) {
         const moves = [];
         const piece = boardState[r][c];
         if (!piece) return moves;

         const opponent = piece.player === PLAYER_A ? PLAYER_B : PLAYER_A;

         for (let dr = -1; dr <= 1; dr++) {
             for (let dc = -1; dc <= 1; dc++) {
                 if (dr === 0 && dc === 0) continue;
                 const nr = r + dr;
                 const nc = c + dc;

                 if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                     const targetCell = boardState[nr][nc];
                     if (targetCell === null) {
                         moves.push({ row: nr, col: nc });
                     } else if (targetCell.player === opponent && targetCell.state === NORMAL) {
                         moves.push({ row: nr, col: nc, isSwap: true });
                     }
                 }
             }
         }
         return moves;
    }

    // Helper to check win condition for a given board state - UPDATED start/target rows
     function checkWinConditionForState(boardState, player) {
         // REVERSED ORIENTATION: Define start/target based on player and new orientation
         const startRow = (player === PLAYER_A) ? ROWS - 2 : 1; // A starts near bottom (idx 6), B near top (idx 1)
         const targetRow = (player === PLAYER_A) ? 1 : ROWS - 2; // A targets near top (idx 1), B targets near bottom (idx 6)

         const visited = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
         const queue = []; // {row, col, path} - path not strictly needed here, just for consistency

         for (let c = 0; c < COLS; c++) {
             // Ensure the piece exists and belongs to the player before starting BFS from it
             if (boardState[startRow] && boardState[startRow][c] && boardState[startRow][c].player === player) {
                 queue.push({ row: startRow, col: c, path: [{ row: startRow, col: c }] });
                 visited[startRow][c] = true;
             }
         }

         while (queue.length > 0) {
             const { row, col } = queue.shift(); // Path details ignored for simple win check
             if (row === targetRow) return { win: true };

             for (let dr = -1; dr <= 1; dr++) {
                 for (let dc = -1; dc <= 1; dc++) {
                     if (dr === 0 && dc === 0) continue;
                     const nr = row + dr;
                     const nc = col + dc;

                     // Check bounds, if visited, and if it's the player's piece
                     if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS &&
                         !visited[nr][nc] &&
                         boardState[nr] && boardState[nr][nc] && boardState[nr][nc].player === player) // Added check for boardState[nr] existence
                     {
                         visited[nr][nc] = true;
                         queue.push({ row: nr, col: nc, path: [] }); // Path details ignored
                     }
                 }
             }
         }
         return { win: false };
     }


     // --- Heuristic Evaluation --- UPDATED for new orientation
    function evaluateBoardState(boardState, player, move, wasEmptyMove) {
        let score = 0;
        const opponent = player === PLAYER_A ? PLAYER_B : PLAYER_A;

        // 1. Check for immediate win for AI (highest priority)
        if (checkWinConditionForState(boardState, player).win) {
            return 1000000; // Very high score for winning move
        }
        // Check for immediate win for opponent (if AI allows it - this check is slightly redundant
        // with allowsOpponentWin but can be a quick penalty if needed, though allowsOpponentWin is better)
        // if (checkWinConditionForState(boardState, opponent).win) {
        //     return -1000000; // Massive penalty if the move leads to immediate loss
        // }


        // Heuristic components (Weights need tuning!)
        const ADVANCE_WEIGHT = 10;
        const BACK_ROW_PENALTY = -20; // Penalty for Player B being on row 0
        const CONNECTIVITY_WEIGHT = 5;
        const FOUR_IN_ROW_PENALTY = -30;
        const SWAP_BONUS = 8; // Bonus for making a swap
        const RESTRICT_OPPONENT_WEIGHT = 2;
        const CENTER_CONTROL_WEIGHT = 1; // Slight bonus for pieces near center cols (1, 2)

        let playerCount = 0;
        let opponentCount = 0;
        let playerConnectivity = 0;
        let opponentConnectivity = 0; // Could be used for defense

        for (let r = 0; r < ROWS; r++) {
            let playerHorizontalRow = 0; // Track horizontal pieces for penalty

            for (let c = 0; c < COLS; c++) {
                const piece = boardState[r][c];
                if (piece) {
                    if (piece.player === player) { // Evaluating for Player B
                        playerCount++;
                        playerHorizontalRow++;

                        // Advancement Score (for Player B, HIGHER row index is better)
                        score += ADVANCE_WEIGHT * r; // <<<< CHANGED

                        // Back Row Penalty (for Player B, row index 0)
                        if (r === 0) { // <<<< CHANGED
                            score += BACK_ROW_PENALTY;
                        }

                        // Connectivity Score
                        playerConnectivity += countFriendlyNeighbors(boardState, r, c, player);

                        // Center Control
                        if (c === 1 || c === 2) {
                            score += CENTER_CONTROL_WEIGHT;
                        }

                    } else { // Opponent piece (Player A)
                        opponentCount++;
                        playerHorizontalRow = 0; // Reset count on opponent piece
                        opponentConnectivity += countFriendlyNeighbors(boardState, r, c, opponent);
                        // Could add opponent advancement penalty here (A wants lower index)
                        // score -= ADVANCE_WEIGHT * (ROWS - 1 - r); // Penalize AI if opponent advances
                    }
                } else {
                     playerHorizontalRow = 0; // Reset count on empty cell
                }

                 // 4-in-a-row Penalty (only check if count reaches 4)
                 if (playerHorizontalRow === 4) {
                     score += FOUR_IN_ROW_PENALTY;
                 }

            }
             playerHorizontalRow = 0; // Reset at end of row
        }

        // Add connectivity scores
        score += CONNECTIVITY_WEIGHT * playerConnectivity;
        // Could subtract opponent connectivity for defense: score -= CONNECTIVITY_WEIGHT * opponentConnectivity;

        // Swap Bonus/Utility
        if (move.isSwap) {
            score += SWAP_BONUS;
            // Potential further analysis: did the swap block a key opponent piece?
            // Or did it open up a path for the AI? (More complex analysis)
        }


         // Opponent Restriction (Approximate) - Count opponent's legal moves
         let opponentMovesCount = 0;
         for (let r = 0; r < ROWS; r++) {
             for (let c = 0; c < COLS; c++) {
                 if (boardState[r][c] && boardState[r][c].player === opponent) {
                     opponentMovesCount += calculateLegalMovesForState(boardState, r, c).length;
                 }
             }
         }
         score -= RESTRICT_OPPONENT_WEIGHT * opponentMovesCount;


        // Add small random factor to break ties sometimes
         score += Math.random() * 0.1;

        return score;
    }

    // (countFriendlyNeighbors remains the same)
    function countFriendlyNeighbors(boardState, r, c, player) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS &&
                    boardState[nr][nc] && boardState[nr][nc].player === player) {
                    count++;
                }
            }
        }
        return count;
    }


    // --- History --- UPDATED row display calculation

    function displayMoveHistory() {
        historyList.innerHTML = ''; // Clear previous list
        if (moveHistory.length === 0) {
            historyList.textContent = 'No moves made yet.';
            return;
        }

        // Display in reverse order (most recent first)
        [...moveHistory].reverse().forEach((move, index) => {
            const moveDiv = document.createElement('div');
            const moveNumber = moveHistory.length - index;
            // Convert internal row (0-7) to display row (8-1) - REVERSED
            const startRowDisplay = ROWS - move.start.row; // <<<< CHANGED
            const endRowDisplay = ROWS - move.end.row;     // <<<< CHANGED
            // Convert col (0-3) to display col (A-D)
            const startColDisplay = String.fromCharCode('A'.charCodeAt(0) + move.start.col);
            const endColDisplay = String.fromCharCode('A'.charCodeAt(0) + move.end.col);

            moveDiv.textContent = `${moveNumber}. Player ${move.player}: ${startColDisplay}${startRowDisplay} -> ${endColDisplay}${endRowDisplay}`;
            moveDiv.addEventListener('click', () => {
                // View state *before* this move was made
                 viewHistoricalState(move.boardBefore); // Pass the correct board state
                hideOverlay(historyOverlay);
            });
            historyList.appendChild(moveDiv);
        });

         // Add option to view initial state
         const initialStateDiv = document.createElement('div');
         initialStateDiv.textContent = `0. Initial State`;
         initialStateDiv.addEventListener('click', () => {
             const initialBoard = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
              // Recreate initial state based on NEW orientation
              for (let r = 0; r < ROWS; r++) {
                 for (let c = 0; c < COLS; c++) {
                     if (r < 2) initialBoard[r][c] = { player: PLAYER_B, state: NORMAL }; // B top
                      else if (r >= ROWS - 2) initialBoard[r][c] = { player: PLAYER_A, state: NORMAL }; // A bottom
                 }
             }
             viewHistoricalState(initialBoard);
             hideOverlay(historyOverlay);
         });
         historyList.appendChild(initialStateDiv); // Add initial state option at the end
    }

     function viewHistoricalState(boardState) {
         console.log("Viewing historical state...");
         // Make sure to deep copy the historical board state
         historicalBoardState = JSON.parse(JSON.stringify(boardState));
         deselectPiece(); // Clear any current selection/highlights
         gameOver = false; // Temporarily unset game over to remove win highlight during history view
         renderBoard(historicalBoardState); // Render the historical board
          // Disable interactions or indicate viewing mode (e.g., message, opacity)
          boardElement.style.opacity = '0.7';
          boardElement.style.cursor = 'pointer'; // Indicate clicking restores state
     }

     function restoreFinalState() {
          console.log("Restoring final game state...");
          historicalBoardState = null; // Clear historical view flag
          gameOver = (winner !== null); // Restore game over status if there was a winner
          deselectPiece();
          renderBoard(board); // Re-render the actual final board
          boardElement.style.opacity = '1';
          boardElement.style.cursor = 'default'; // Restore default cursor
     }

    // --- Overlay Management ---
    // (showOverlay, hideOverlay, hideAllOverlays remain the same)
    function showOverlay(overlayElement) {
        overlayElement.classList.add('active');
    }

    function hideOverlay(overlayElement) {
        overlayElement.classList.remove('active');
    }
     function hideAllOverlays() {
          overlays.forEach(hideOverlay);
     }

    // --- Start Game ---
    initGame();

});