<?php
/**
 * Simple storage API - GET and POST settings files
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$storageDir = '/var/www/storage';

// Ensure storage directory exists
if (!is_dir($storageDir)) {
    mkdir($storageDir, 0755, true);
}

// GET - Load settings
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $filename = $_GET['file'] ?? '';
    
    // Validate filename
    if (!preg_match('/^[a-f0-9]{16}\.json$/', $filename)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid filename']);
        exit;
    }
    
    $filepath = $storageDir . '/' . $filename;
    
    if (file_exists($filepath)) {
        header('Content-Type: text/plain');
        echo file_get_contents($filepath);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'File not found']);
    }
    exit;
}

// POST - Save settings
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    $filename = $data['filename'] ?? '';
    $content = $data['data'] ?? '';
    
    // Validate
    if (!preg_match('/^[a-f0-9]{16}\.json$/', $filename)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid filename']);
        exit;
    }
    
    if (empty($content)) {
        http_response_code(400);
        echo json_encode(['error' => 'No data']);
        exit;
    }
    
    // Save
    $filepath = $storageDir . '/' . $filename;
    file_put_contents($filepath, $content);
    chmod($filepath, 0644);
    
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
?>
