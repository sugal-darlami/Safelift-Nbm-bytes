-- SafeLift 360 Database Schema (Stage 2.3)
CREATE DATABASE IF NOT EXISTS `safelift360`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `safelift360`;

-- Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `employee_id` VARCHAR(50) DEFAULT NULL,
  `role` VARCHAR(30) NOT NULL DEFAULT 'employee',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Training Results Table
CREATE TABLE IF NOT EXISTS `training_results` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `load_inspection_score` INT NOT NULL DEFAULT 0,
  `route_check_score` INT NOT NULL DEFAULT 0,
  `safe_lift_score` INT NOT NULL DEFAULT 0,
  `safety_precautions_score` INT NOT NULL DEFAULT 0,
  `total_score` INT NOT NULL DEFAULT 0,
  `percentage` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `training_duration_seconds` INT NOT NULL DEFAULT 0,
  `completed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(20) NOT NULL DEFAULT 'completed',
  CONSTRAINT `fk_training_results_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Certificates Table (Stage 5.1)
CREATE TABLE IF NOT EXISTS `certificates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `certificate_uuid` VARCHAR(100) NOT NULL UNIQUE,
  `user_id` INT NOT NULL,
  `training_result_id` INT NOT NULL UNIQUE,
  `certificate_number` VARCHAR(100) NOT NULL UNIQUE,
  `issued_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(20) NOT NULL DEFAULT 'issued',
  CONSTRAINT `fk_certificates_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_certificates_training_result`
    FOREIGN KEY (`training_result_id`) REFERENCES `training_results` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

